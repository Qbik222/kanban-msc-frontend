import { Injectable, signal } from '@angular/core';
import { UserProfile } from '../../models/board.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly accessToken = signal<string | null>(null);
  readonly csrfToken = signal<string | null>(null);

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
  }

  updateTokens(accessToken: string | null | undefined, csrfToken: string | null | undefined): void {
    this.setSession({ accessToken, csrfToken });
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.csrfToken.set(null);
  }

  // Legacy alias preserved for existing callers.
  getToken(): string | null {
    return this.getAccessToken();
  }

  // Legacy alias preserved for existing callers.
  setToken(token: string | null | undefined): void {
    this.updateTokens(token, this.getCsrfToken());
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
