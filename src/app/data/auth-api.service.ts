import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserProfile } from '../models/board.models';

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  password: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthResponse {
  accessToken: string;
  csrfToken: string;
  user: Record<string, unknown>;
}

export interface RefreshResponse {
  accessToken: string;
  csrfToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/auth`;

  login(body: LoginBody): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/login`, body, {
      withCredentials: true,
    });
  }

  register(body: RegisterBody): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/register`, body, {
      withCredentials: true,
    });
  }

  refresh(csrfToken: string): Observable<RefreshResponse> {
    return this.http.post<RefreshResponse>(
      `${this.base}/refresh`,
      {},
      {
        withCredentials: true,
        headers: { 'X-CSRF-Token': csrfToken },
      },
    );
  }

  logout(csrfToken: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/logout`,
      {},
      {
        withCredentials: true,
        headers: { 'X-CSRF-Token': csrfToken },
      },
    );
  }

  me(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.apiUrl}/users/me`, {
      withCredentials: true,
    });
  }
}
