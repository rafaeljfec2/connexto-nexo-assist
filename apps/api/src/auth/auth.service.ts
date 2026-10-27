import { Injectable, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { createDb, type AppDatabase } from '../db/client';
import { sessions, users } from '../db/schema';
import { hashToken, newSessionToken } from '../common/crypto';

const GENERIC_LOGIN_ERROR = 'E-mail ou senha inválidos.';

@Injectable()
export class AuthService {
  private db: AppDatabase = createDb();

  static withDb(db: AppDatabase): AuthService {
    const service = new AuthService();
    service.db = db;
    return service;
  }

  async login(email: string, password: string, rememberMe: boolean) {
    if (!password || password.length === 0) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    const normalized = email.trim().toLowerCase();
    const rows = await this.db.select().from(users).where(eq(users.email, normalized));
    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    const token = newSessionToken();
    const hours = rememberMe ? 24 * 7 : 12;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await this.db.insert(sessions).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    });

    return {
      token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        area: user.area,
        role: user.role,
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  async resolveSession(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Sessão expirada ou ausente.');
    }
    const rows = await this.db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        userId: users.id,
        email: users.email,
        name: users.name,
        area: users.area,
        role: users.role,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, hashToken(token)));

    const row = rows[0];
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      if (row) {
        await this.db.delete(sessions).where(eq(sessions.id, row.sessionId));
      }
      throw new UnauthorizedException('Sessão expirada ou ausente.');
    }

    return {
      id: row.userId,
      email: row.email,
      name: row.name,
      area: row.area,
      role: row.role as 'employee' | 'analyst',
    };
  }
}
