import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthApiService } from '../../data/auth-api.service';
import { BoardStore } from '../../state/board.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <div class="flex min-h-screen flex-col">
      <header
        class="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur"
      >
        <a routerLink="/boards" class="text-lg font-semibold text-white">Kanban</a>
        <div class="flex items-center gap-4">
          @if (boardStore.user(); as u) {
            <span class="text-sm text-slate-400">{{ u.name }}</span>
          }
          <button
            type="button"
            class="text-sm text-slate-400 hover:text-white"
            (click)="logout()"
          >
            Sign out
          </button>
        </div>
      </header>
      <div class="flex flex-1 min-h-0">
        <aside class="hidden w-52 shrink-0 border-r border-slate-800 bg-slate-900/50 p-4 md:block">
          <nav class="flex flex-col gap-2 text-sm">
            <a
              routerLink="/boards"
              class="rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
              routerLinkActive="bg-slate-800 text-white"
              >Boards</a
            >
          </nav>
        </aside>
        <main class="min-w-0 flex-1 overflow-auto p-4">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent implements OnInit {
  readonly boardStore = inject(BoardStore);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (this.auth.hasSession() && !this.boardStore.user()) {
      try {
        const me = await firstValueFrom(this.authApi.me());
        this.boardStore.setUser(me);
      } catch {
        this.auth.clearSession();
      }
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.authApi.logout());
    } catch {
      // Client-side cleanup should still happen even if backend logout fails.
    } finally {
      this.auth.clearSession();
      this.boardStore.setUser(null);
      this.boardStore.setActiveBoard(null);
      void this.router.navigateByUrl('/login');
    }
  }
}
