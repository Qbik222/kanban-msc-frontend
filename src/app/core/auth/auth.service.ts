import { Injectable, Injector, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../data/auth-api.service';
import { UserProfile } from '../../models/board.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly injector = inject(Injector);
  private sessionBootstrap: Promise<void> | null = null;

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

  /**
   * Runs once per app load: silent refresh when access is not in memory but refresh cookie may exist.
   * Idempotent; safe to await from guards after APP_INITIALIZER.
   */
  bootstrapSession(): Promise<void> {
    if (!this.sessionBootstrap) {
      this.sessionBootstrap = this.runSessionBootstrap();
    }
    return this.sessionBootstrap;
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

  private async runSessionBootstrap(): Promise<void> {
    if (this.hasSession()) {
      return;
    }
    const authApi = this.injector.get(AuthApiService);
    try {
      const tokens = await firstValueFrom(authApi.refresh());
      this.setSession({ accessToken: tokens.accessToken, csrfToken: tokens.csrfToken });
    } catch {
      /* guest or invalid refresh — stay logged out */
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
