import { Injectable, signal } from '@angular/core';
import { UserProfile } from '../../models/board.models';

const TOKEN_KEY = 'kanban_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly token = signal<string | null>(this.readToken());

  getToken(): string | null {
    return this.token();
  }

  setToken(token: string | null): void {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    this.token.set(token);
  }

  private readToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(TOKEN_KEY);
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
