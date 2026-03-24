import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../data/auth-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { BoardStore } from '../../state/board.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <h1 class="mb-6 text-2xl font-semibold text-white">Sign in</h1>
      <form class="flex flex-col gap-4" (ngSubmit)="submit()">
        <label class="flex flex-col gap-1 text-sm text-slate-300">
          Email
          <input
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            type="email"
            name="email"
            [(ngModel)]="email"
            required
            autocomplete="email"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-slate-300">
          Password
          <input
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            type="password"
            name="password"
            [(ngModel)]="password"
            required
            minlength="6"
            autocomplete="current-password"
          />
        </label>
        <button
          type="submit"
          class="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          [disabled]="pending"
        >
          {{ pending ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <p class="mt-4 text-sm text-slate-400">
        No account?
        <a routerLink="/register" class="text-emerald-400 hover:underline">Register</a>
      </p>
    </div>
  `,
})
export class LoginComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly boardStore = inject(BoardStore);
  private readonly router = inject(Router);

  email = '';
  password = '';
  pending = false;

  async submit(): Promise<void> {
    this.pending = true;
    try {
      const res = await firstValueFrom(
        this.authApi.login({ email: this.email, password: this.password }),
      );
      if (!res.accessToken || !res.csrfToken) {
        throw new Error('Authentication token is missing in login response.');
      }
      this.auth.setSession({
        accessToken: res.accessToken,
        csrfToken: res.csrfToken,
      });
      const user = this.auth.normalizeUser(res.user as Record<string, unknown>);
      this.boardStore.setUser(user);
      await this.router.navigateByUrl('/teams');
    } finally {
      this.pending = false;
    }
  }
}
