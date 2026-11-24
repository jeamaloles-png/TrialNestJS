import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../database/database.service';

type VaultGame = RowDataPacket & { id: number; name: string };
type VaultRow = RowDataPacket & {
  id: number;
  game_name: string;
  username: string;
  email: string | null;
  notes: string | null;
  password_ciphertext: string;
  password_iv: string;
  password_auth_tag: string;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class VaultService {
  constructor(private readonly database: DatabaseService) {}

  private pool = () => this.database.getPool();

  private requireOwner(ownerId: number) {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      throw new UnauthorizedException('Sign in to access your game vault.');
    }
  }

  private key() {
    const value = process.env.VAULT_KEY;
    if (!value || !/^[\da-f]{64}$/i.test(value)) {
      throw new ServiceUnavailableException('The encrypted credential vault is not configured.');
    }
    return Buffer.from(value, 'hex');
  }

  private encrypt(password: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return {
      password_ciphertext: ciphertext.toString('base64'),
      password_iv: iv.toString('hex'),
      password_auth_tag: cipher.getAuthTag().toString('hex'),
    };
  }

  private decrypt(row: VaultRow) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(row.password_iv, 'hex'));
      decipher.setAuthTag(Buffer.from(row.password_auth_tag, 'hex'));
      return Buffer.concat([
        decipher.update(Buffer.from(row.password_ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException('This credential could not be decrypted. Check the vault key.');
    }
  }

  private async gameForOwner(ownerId: number, gameId: number) {
    const [rows] = await this.pool().execute<VaultGame[]>(
      'SELECT id, name FROM game_hub_games WHERE id = ? AND owner_id = ?',
      [gameId, ownerId],
    );
    if (!rows[0]) throw new BadRequestException('Choose a game from your saved game list.');
    return rows[0];
  }

  async listGames(ownerId: number) {
    this.requireOwner(ownerId);
    const [rows] = await this.pool().execute<VaultGame[]>(
      'SELECT id, name FROM game_hub_games WHERE owner_id = ? ORDER BY name',
      [ownerId],
    );
    return rows;
  }

  async addGame(ownerId: number, rawName?: string) {
    this.requireOwner(ownerId);
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name || name.length > 80) throw new BadRequestException('Game name must be between 1 and 80 characters.');
    try {
      const [result] = await this.pool().execute<ResultSetHeader>(
        'INSERT INTO game_hub_games (owner_id, name) VALUES (?, ?)',
        [ownerId, name],
      );
      return { id: result.insertId, name };
    } catch (error) {
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('That game is already in your list.');
      }
      throw error;
    }
  }

  async removeGame(ownerId: number, idValue: string) {
    this.requireOwner(ownerId);
    const id = Number(idValue);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Invalid game id.');
    const [result] = await this.pool().execute<ResultSetHeader>(
      'DELETE FROM game_hub_games WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    if (!result.affectedRows) throw new NotFoundException('Game not found.');
    // Saved credentials keep their game-name snapshot when the selectable game is removed.
    return { ok: true };
  }

  async listAccounts(ownerId: number, rawQuery = '') {
    this.requireOwner(ownerId);
    const query = String(rawQuery).trim().slice(0, 100);
    const like = `%${query}%`;
    const [rows] = await this.pool().execute<RowDataPacket[]>(
      `SELECT id, game_name AS gameName, username, email, notes,
              created_at AS createdAt, updated_at AS updatedAt
       FROM game_hub_accounts
       WHERE owner_id = ? AND (? = '' OR game_name LIKE ? OR username LIKE ? OR
             COALESCE(email, '') LIKE ? OR COALESCE(notes, '') LIKE ?)
       ORDER BY updated_at DESC, id DESC`,
      [ownerId, query, like, like, like, like],
    );
    return rows;
  }

  async addAccount(
    ownerId: number,
    body: { gameId?: number; username?: string; password?: string; email?: string; notes?: string },
  ) {
    this.requireOwner(ownerId);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!Number.isSafeInteger(Number(body?.gameId)) || !username || !password) {
      throw new BadRequestException('Choose a game and enter the game username and password.');
    }
    if (username.length > 120 || password.length > 2048) throw new BadRequestException('Account credentials are too long.');
    const game = await this.gameForOwner(ownerId, Number(body.gameId));
    const encrypted = this.encrypt(password);
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 255) : null;
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null;
    const [result] = await this.pool().execute<ResultSetHeader>(
      `INSERT INTO game_hub_accounts
       (owner_id, game_name, username, email, notes, password_ciphertext, password_iv, password_auth_tag)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [ownerId, game.name, username, email, notes, encrypted.password_ciphertext, encrypted.password_iv, encrypted.password_auth_tag],
    );
    return { id: result.insertId, gameName: game.name, username, email, notes };
  }

  private async ownedAccount(ownerId: number, idValue: string) {
    const id = Number(idValue);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Invalid account id.');
    const [rows] = await this.pool().execute<VaultRow[]>(
      'SELECT * FROM game_hub_accounts WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    if (!rows[0]) throw new NotFoundException('Game account not found.');
    return rows[0];
  }

  async revealAccount(ownerId: number, id: string) {
    this.requireOwner(ownerId);
    const row = await this.ownedAccount(ownerId, id);
    return {
      id: row.id,
      gameName: row.game_name,
      username: row.username,
      password: this.decrypt(row),
      email: row.email,
      notes: row.notes,
    };
  }

  async updateAccount(
    ownerId: number,
    id: string,
    body: { gameId?: number; username?: string; password?: string; email?: string; notes?: string },
  ) {
    this.requireOwner(ownerId);
    await this.ownedAccount(ownerId, id);
    const username = typeof body?.username === 'string' ? body.username.trim() : '';
    if (!Number.isSafeInteger(Number(body?.gameId)) || !username) {
      throw new BadRequestException('Choose a game and enter the game username.');
    }
    if (username.length > 120 || (body.password && body.password.length > 2048)) {
      throw new BadRequestException('Account credentials are too long.');
    }
    const game = await this.gameForOwner(ownerId, Number(body.gameId));
    const email = typeof body.email === 'string' && body.email.trim() ? body.email.trim().slice(0, 255) : null;
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 4000) : null;
    const values: unknown[] = [game.name, username, email, notes];
    let encryptedSql = '';
    if (typeof body.password === 'string' && body.password.length > 0) {
      const encrypted = this.encrypt(body.password);
      encryptedSql = ', password_ciphertext = ?, password_iv = ?, password_auth_tag = ?';
      values.push(encrypted.password_ciphertext, encrypted.password_iv, encrypted.password_auth_tag);
    }
    values.push(Number(id), ownerId);
    await this.pool().execute(
      `UPDATE game_hub_accounts SET game_name = ?, username = ?, email = ?, notes = ?${encryptedSql}
       WHERE id = ? AND owner_id = ?`,
      values as any[],
    );
    return { ok: true };
  }

  async deleteAccount(ownerId: number, idValue: string) {
    this.requireOwner(ownerId);
    const id = Number(idValue);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Invalid account id.');
    const [result] = await this.pool().execute<ResultSetHeader>(
      'DELETE FROM game_hub_accounts WHERE id = ? AND owner_id = ?',
      [id, ownerId],
    );
    if (!result.affectedRows) throw new NotFoundException('Game account not found.');
    return { ok: true };
  }
}
