import { Component, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '../../state/team.store';
import { TeamMemberRole } from '../../models/team.models';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-3xl">
      <p class="mb-4 text-sm">
        <a routerLink="/teams" class="text-emerald-400 hover:underline">← До списку команд</a>
      </p>

      @if (teamStore.loading() && !teamStore.activeTeam()) {
        <p class="text-slate-400">Завантаження…</p>
      } @else if (teamStore.error()) {
        <p class="text-red-400">{{ teamStore.error() }}</p>
      } @else {
        @if (teamStore.activeTeam(); as team) {
          <h1 class="mb-2 text-2xl font-semibold text-white">{{ team.name }}</h1>
          <p class="mb-6 text-sm text-slate-400">
            Ваша роль: {{ team.role === 'admin' ? 'адмін' : 'учасник' }}
          </p>

          @if (team.role === 'admin') {
            <div class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h2 class="mb-3 text-sm font-medium text-slate-300">Запросити учасника</h2>
              <p class="mb-2 text-xs text-slate-500">Вкажіть userId користувача (він має бути зареєстрований).</p>
              <div class="flex flex-wrap gap-2">
                <input
                  class="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  placeholder="User ID"
                  [(ngModel)]="newMemberUserId"
                  name="userId"
                />
                <button
                  type="button"
                  class="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                  [disabled]="adding || !newMemberUserId.trim()"
                  (click)="addMember(team.id)"
                >
                  {{ adding ? 'Додавання…' : 'Додати' }}
                </button>
              </div>
            </div>

            @if (team.members?.length) {
              <h2 class="mb-3 text-sm font-medium text-slate-300">Учасники</h2>
              <ul class="flex flex-col gap-2">
                @for (m of team.members; track m.userId) {
                  <li
                    class="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
                  >
                    <div>
                      <span class="text-slate-200">{{ m.name || m.email || m.userId }}</span>
                      <span class="ml-2 text-xs text-slate-500">{{ m.userId }}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <select
                        class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                        [ngModel]="m.role"
                        (ngModelChange)="onRoleChange(team.id, m.userId, $event)"
                        [disabled]="roleUpdating === m.userId"
                      >
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </select>
                      <button
                        type="button"
                        class="text-xs text-red-400 hover:underline disabled:opacity-50"
                        [disabled]="removing === m.userId"
                        (click)="removeMember(team.id, m.userId)"
                      >
                        Вилучити
                      </button>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-sm text-slate-500">Список учасників порожній або API не повертає members у відповіді.</p>
            }
          } @else {
            <p class="text-slate-400">Керування учасниками доступне лише адміністратору команди.</p>
          }
        } @else {
          <p class="text-slate-400">Команду не знайдено.</p>
        }
      }
    </div>
  `,
})
export class TeamDetailComponent implements OnDestroy {
  readonly teamStore = inject(TeamStore);
  private readonly route = inject(ActivatedRoute);

  newMemberUserId = '';
  adding = false;
  removing: string | null = null;
  roleUpdating: string | null = null;

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('teamId')),
        filter((id): id is string => !!id),
      )
      .subscribe((id) => {
        void this.teamStore.loadTeamDetail(id);
      });
  }

  ngOnDestroy(): void {
    this.teamStore.clearActiveTeam();
  }

  async addMember(teamId: string): Promise<void> {
    const uid = this.newMemberUserId.trim();
    if (!uid || this.adding) {
      return;
    }
    this.adding = true;
    try {
      const ok = await this.teamStore.addMember(teamId, uid);
      if (ok) {
        this.newMemberUserId = '';
      }
    } finally {
      this.adding = false;
    }
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    if (!confirm('Вилучити цього учасника з команди?')) {
      return;
    }
    this.removing = userId;
    try {
      await this.teamStore.removeMember(teamId, userId);
    } finally {
      this.removing = null;
    }
  }

  async onRoleChange(teamId: string, userId: string, role: string): Promise<void> {
    const r = role as TeamMemberRole;
    if (r !== 'admin' && r !== 'user') {
      return;
    }
    this.roleUpdating = userId;
    try {
      await this.teamStore.patchMemberRole(teamId, userId, r);
    } finally {
      this.roleUpdating = null;
    }
  }
}
