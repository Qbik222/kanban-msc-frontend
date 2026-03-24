import { Injectable, signal } from '@angular/core';
import { UserProfile } from '../../models/board.models';

const SESSION_STORAGE_KEY = 'kanban_auth_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly accessToken = signal<string | null>(null);
  readonly csrfToken = signal<string | null>(null);

  constructor() {
    this.hydrateFromStorage();
  }

  getAccessToken(): string | null {
    return this.normalizeToken(this.accessToken());
  }

  getCsrfToken(): string | null {
    return this.normalizeToken(this.csrfToken());
  }

  hasSession(): boolean {
    return !!this.getAccessToken();
  }

  setSession(tokens: { accessToken: string | null | undefined; csrfToken: string | null | undefined }): void {
    this.accessToken.set(this.normalizeToken(tokens.accessToken));
    this.csrfToken.set(this.normalizeToken(tokens.csrfToken));
    this.syncSessionStorage();
  }

  updateTokens(accessToken: string | null | undefined, csrfToken: string | null | undefined): void {
    this.setSession({ accessToken, csrfToken });
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.csrfToken.set(null);
    this.removeSessionStorage();
  }

  // Legacy alias preserved for existing callers.
  getToken(): string | null {
    return this.getAccessToken();
  }

  // Legacy alias preserved for existing callers.
  setToken(token: string | null | undefined): void {
    this.updateTokens(token, this.getCsrfToken());
  }

  private hydrateFromStorage(): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }
    try {
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        storage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      const record = parsed as Record<string, unknown>;
      const access = this.normalizeToken(record['accessToken'] as string | null | undefined);
      const csrf = this.normalizeToken(record['csrfToken'] as string | null | undefined);
      if (!access) {
        storage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      this.accessToken.set(access);
      this.csrfToken.set(csrf);
    } catch {
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private syncSessionStorage(): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }
    try {
      const access = this.accessToken();
      const csrf = this.csrfToken();
      if (!access) {
        storage.removeItem(SESSION_STORAGE_KEY);
        return;
      }
      storage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ accessToken: access, csrfToken: csrf }),
      );
    } catch {
      try {
        storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private removeSessionStorage(): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }
    try {
      storage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  private getSessionStorage(): Storage | null {
    try {
      if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) {
        return null;
      }
      return globalThis.sessionStorage;
    } catch {
      return null;
    }
  }

  private normalizeToken(token: string | null | undefined): string | null {
    if (!token) {
      return null;
    }
    const cleaned = token.replace(/^Bearer\s+/i, '').trim();
    if (!cleaned || cleaned === 'undefined' || cleaned === 'null') {
      return null;
    }
    return cleaned;
  }

  normalizeUser(raw: Record<string, unknown>): UserProfile {
    const id = (raw['id'] ?? raw['_id']) as string;
    return {
      id,
      email: raw['email'] as string,
      name: raw['name'] as string,
      avatarUrl: raw['avatarUrl'] as string | undefined,
      createdAt: raw['createdAt'] as string | undefined,
      updatedAt: raw['updatedAt'] as string | undefined,
    };
  }
}
