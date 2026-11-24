import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

const TABLES = ['RIOT', 'LeagueOfLegend', 'Valorant'] as const;
type GameTable = typeof TABLES[number];

@Injectable()
export class GamesService {
  constructor(private readonly db: DatabaseService) {}
  private pool = () => this.db.getPool();

  private table(value: string): GameTable {
    if (!TABLES.includes(value as GameTable)) throw new Error(`Unknown table. Use: ${TABLES.join(', ')}`);
    return value as GameTable;
  }

  private quote(value: string) { return `\`${value.replace(/`/g, '``')}\``; }

  async schema(name: string) {
    const table = this.table(name);
    const [columns] = await this.pool().query<RowDataPacket[]>('SHOW COLUMNS FROM ??', [table]);
    const [keys] = await this.pool().query<RowDataPacket[]>("SHOW KEYS FROM ?? WHERE Key_name = 'PRIMARY'", [table]);
    if (!columns.length) throw new Error(`Table ${table} does not exist`);
    return { table, primaryKey: keys[0]?.Column_name ?? 'id', columns: columns.map((column) => column.Field) };
  }

  async health() {
    await this.pool().query('SELECT 1');
    return { status: 'ok' };
  }

  async all(name: string, ownerId: number) {
    const table = this.table(name);
    if (table === 'RIOT') {
      const [rows] = await this.pool().execute<RowDataPacket[]>(
        'SELECT * FROM `RIOT` WHERE `user_id` = ?', [ownerId],
      );
      return rows;
    }
    const [rows] = await this.pool().execute<RowDataPacket[]>(
      `SELECT g.* FROM ${this.quote(table)} AS g
       INNER JOIN \`RIOT\` AS r ON r.id = g.riot_id
       WHERE r.user_id = ?`,
      [ownerId],
    );
    return rows;
  }

  async one(name: string, id: string, ownerId: number) {
    const table = this.table(name);
    const info = await this.schema(table);
    if (table === 'RIOT') {
      const [rows] = await this.pool().execute<RowDataPacket[]>(
        `SELECT * FROM \`RIOT\` WHERE ${this.quote(info.primaryKey)} = ? AND user_id = ?`,
        [id, ownerId],
      );
      return rows[0] ?? null;
    }
    const [rows] = await this.pool().execute<RowDataPacket[]>(
      `SELECT g.* FROM ${this.quote(table)} AS g
       INNER JOIN \`RIOT\` AS r ON r.id = g.riot_id
       WHERE g.${this.quote(info.primaryKey)} = ? AND r.user_id = ?`,
      [id, ownerId],
    );
    return rows[0] ?? null;
  }

  async create(name: string, body: Record<string, unknown>, ownerId: number) {
    const table = this.table(name);
    const info = await this.schema(table);
    if (!body || Array.isArray(body) || typeof body !== 'object' || !Object.keys(body).length) {
      throw new Error('Provide at least one column in the JSON body');
    }

    const values = { ...body };
    if (table === 'RIOT') {
      // The authenticated user's identity comes from the token, never the request body.
      values.user_id = ownerId;
    } else {
      const riotId = Number(values.riot_id);
      if (!Number.isSafeInteger(riotId) || !await this.ownsRiotProfile(riotId, ownerId)) {
        throw new Error('The linked Riot profile does not belong to this account');
      }
    }
    const fields = Object.keys(values);
    const invalid = fields.filter((key) => !info.columns.includes(key));
    if (invalid.length) throw new Error(`Unknown column(s): ${invalid.join(', ')}`);
    const sql = `INSERT INTO ${this.quote(table)} (${fields.map((field) => this.quote(field)).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
    const [result] = await this.pool().execute<ResultSetHeader>(sql, fields.map((field) => values[field]) as any[]);
    return { message: 'Created', id: result.insertId || null, affectedRows: result.affectedRows };
  }

  async update(name: string, id: string, body: Record<string, unknown>, ownerId: number) {
    const table = this.table(name);
    const info = await this.schema(table);
    if (!body || Array.isArray(body) || typeof body !== 'object' || !Object.keys(body).length) {
      throw new Error('Provide at least one column in the JSON body');
    }
    if (!await this.one(table, id, ownerId)) return { message: 'No matching row', affectedRows: 0 };

    const values = { ...body };
    if (table === 'RIOT') {
      if ('user_id' in values) values.user_id = ownerId;
    } else if ('riot_id' in values) {
      const riotId = Number(values.riot_id);
      if (!Number.isSafeInteger(riotId) || !await this.ownsRiotProfile(riotId, ownerId)) {
        throw new Error('The linked Riot profile does not belong to this account');
      }
    }
    const fields = Object.keys(values);
    const invalid = fields.filter((key) => !info.columns.includes(key));
    if (invalid.length) throw new Error(`Unknown column(s): ${invalid.join(', ')}`);

    let sql: string;
    const whereValues: unknown[] = [id, ownerId];
    if (table === 'RIOT') {
      sql = `UPDATE \`RIOT\` SET ${fields.map((field) => `${this.quote(field)} = ?`).join(', ')} WHERE ${this.quote(info.primaryKey)} = ? AND user_id = ?`;
    } else {
      sql = `UPDATE ${this.quote(table)} AS g
             INNER JOIN \`RIOT\` AS r ON r.id = g.riot_id
             SET ${fields.map((field) => `g.${this.quote(field)} = ?`).join(', ')}
             WHERE g.${this.quote(info.primaryKey)} = ? AND r.user_id = ?`;
    }
    const [result] = await this.pool().execute<ResultSetHeader>(sql, [...fields.map((field) => values[field]), ...whereValues] as any[]);
    return { message: result.affectedRows ? 'Updated' : 'No matching row', affectedRows: result.affectedRows };
  }

  async remove(name: string, id: string, ownerId: number) {
    const table = this.table(name);
    const info = await this.schema(table);
    let sql: string;
    if (table === 'RIOT') {
      sql = `DELETE FROM \`RIOT\` WHERE ${this.quote(info.primaryKey)} = ? AND user_id = ?`;
    } else {
      sql = `DELETE g FROM ${this.quote(table)} AS g
             INNER JOIN \`RIOT\` AS r ON r.id = g.riot_id
             WHERE g.${this.quote(info.primaryKey)} = ? AND r.user_id = ?`;
    }
    const [result] = await this.pool().execute<ResultSetHeader>(sql, [id, ownerId]);
    return { message: result.affectedRows ? 'Deleted' : 'No matching row', affectedRows: result.affectedRows };
  }

  private async ownsRiotProfile(riotId: number, ownerId: number) {
    const [rows] = await this.pool().execute<RowDataPacket[]>(
      'SELECT id FROM `RIOT` WHERE id = ? AND user_id = ?', [riotId, ownerId],
    );
    return rows.length > 0;
  }
}
