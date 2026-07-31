import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthApiService } from '../../../data/auth-api.service';
import { BoardStore } from '../../../state/board.store';
import { TeamStore } from '../../../state/team.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  readonly boardStore = inject(BoardStore);
  readonly teamStore = inject(TeamStore);
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
    if (this.auth.hasSession()) {
      void this.teamStore.loadTeams();
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
      this.teamStore.reset();
      void this.router.navigateByUrl('/login');
    }
  }
}
