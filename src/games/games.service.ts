import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
    return { table, primaryKey: keys[0]?.Column_name ?? 'id', columns: columns.map((c) => c.Field) };
  }
  async health() {
    await this.pool().query('SELECT 1');
    return { status: 'ok', database: 'defaultdb' };
  }
  async all(name: string) {
    const table = this.table(name);
    const [rows] = await this.pool().query<RowDataPacket[]>(`SELECT * FROM ${this.quote(table)}`);
    return rows;
  }
  async one(name: string, id: string) {
    const table = this.table(name), info = await this.schema(table);
    const [rows] = await this.pool().execute<RowDataPacket[]>(`SELECT * FROM ${this.quote(table)} WHERE ${this.quote(info.primaryKey)} = ?`, [id]);
    return rows[0] ?? null;
  }
  async create(name: string, body: Record<string, unknown>) {
    const table = this.table(name), info = await this.schema(table);
    if (!body || Array.isArray(body) || typeof body !== 'object' || !Object.keys(body).length) throw new Error('Provide at least one column in the JSON body');
    const fields = Object.keys(body);
    const invalid = fields.filter((key) => !info.columns.includes(key));
    if (invalid.length) throw new Error(`Unknown column(s): ${invalid.join(', ')}`);
    const sql = `INSERT INTO ${this.quote(table)} (${fields.map((f) => this.quote(f)).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`;
    const [result] = await this.pool().execute<ResultSetHeader>(sql, fields.map((f) => body[f]) as any[]);
    return { message: 'Created', id: result.insertId || null, affectedRows: result.affectedRows };
  }
  async update(name: string, id: string, body: Record<string, unknown>) {
    const table = this.table(name), info = await this.schema(table);
    if (!body || Array.isArray(body) || typeof body !== 'object' || !Object.keys(body).length) throw new Error('Provide at least one column in the JSON body');
    const fields = Object.keys(body);
    const invalid = fields.filter((key) => !info.columns.includes(key));
    if (invalid.length) throw new Error(`Unknown column(s): ${invalid.join(', ')}`);
    const sql = `UPDATE ${this.quote(table)} SET ${fields.map((f) => `${this.quote(f)} = ?`).join(', ')} WHERE ${this.quote(info.primaryKey)} = ?`;
    const [result] = await this.pool().execute<ResultSetHeader>(sql, [...fields.map((f) => body[f]), id] as any[]);
    return { message: result.affectedRows ? 'Updated' : 'No matching row', affectedRows: result.affectedRows };
  }
  async remove(name: string, id: string) {
    const table = this.table(name), info = await this.schema(table);
    const [result] = await this.pool().execute<ResultSetHeader>(`DELETE FROM ${this.quote(table)} WHERE ${this.quote(info.primaryKey)} = ?`, [id]);
    return { message: result.affectedRows ? 'Deleted' : 'No matching row', affectedRows: result.affectedRows };
  }
}


