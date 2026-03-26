import { Component, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '../../state/team.store';
import { TeamsApiService } from '../../data/teams-api.service';
import { TeamInviteCandidate, TeamMemberRole } from '../../models/team.models';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../core/toast/toast.service';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';

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
              <h2 class="mb-3 text-sm font-medium text-slate-300">Перейменувати команду</h2>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label class="flex flex-1 flex-col gap-1 text-xs text-slate-400">
                  Назва
                  <input
                    class="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="New team name"
                    [ngModel]="renameTeamName || team.name"
                    (ngModelChange)="renameTeamName = $event"
                    [disabled]="renamingTeam"
                  />
                </label>
                <button
                  type="button"
                  class="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
                  [disabled]="renamingTeam || !(renameTeamName || '').trim() || (renameTeamName || '').trim() === team.name"
                  (click)="renameTeam(team.id, team.name)"
                >
                  {{ renamingTeam ? 'Збереження…' : 'Зберегти' }}
                </button>
              </div>
              @if (renameTeamError) {
                <p class="mt-2 text-xs text-red-400">{{ renameTeamError }}</p>
              }
            </div>

            <div class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h2 class="mb-3 text-sm font-medium text-slate-300">Інвайт у команду</h2>
              <p class="mb-2 text-xs text-slate-500">Пошук користувачів за email-фрагментом</p>

              @if (inviteSearchBlocked403) {
                <p class="text-xs text-red-400">Немає прав на пошук кандидатів у цій команді.</p>
              } @else {
                <div class="flex flex-col gap-2">
                  <input
                    class="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                    placeholder="Email fragment"
                    [(ngModel)]="inviteQuery"
                    (ngModelChange)="onInviteQueryChange($event)"
                    [disabled]="inviteSearchLoading || inviteAddLoading"
                  />

                  @if (inviteSearchLoading) {
                    <p class="text-xs text-slate-400">Завантаження…</p>
                  } @else if (inviteQuery.trim().length >= 2) {
                    @if (inviteCandidates.length) {
                      <ul class="max-h-48 overflow-auto flex flex-col gap-2">
                        @for (c of inviteCandidates; track c.id) {
                          <li>
                            <button
                              type="button"
                              class="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                              [disabled]="inviteAddLoading"
                              (click)="inviteMember(team.id, c)"
                            >
                              <span class="block text-slate-200">{{ c.name || c.email }}</span>
                              <span class="block text-xs text-slate-500">{{ c.email }} · {{ c.id }}</span>
                            </button>
                          </li>
                        }
                      </ul>
                    } @else {
                      <p class="text-xs text-red-400">нічого не знайдено</p>
                    }
                  }

                  @if (inviteSearchError) {
                    <p class="text-xs text-red-400">{{ inviteSearchError }}</p>
                  }

                  @if (inviteSuccessMessage) {
                    <p class="inline-block rounded border border-emerald-800 bg-emerald-900/40 px-2 py-1 text-xs text-emerald-200">
                      {{ inviteSuccessMessage }}
                    </p>
                  }
                </div>
              }
            </div>
          } @else {
            <p class="mb-3 text-slate-400">
              Список учасників доступний усім, але керування (інвайт/зміна ролей) доступне лише адміністратору команди.
            </p>
          }

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
                    @if (team.role === 'admin') {
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
                    } @else {
                      <span class="text-xs text-slate-300">
                        Роль: {{ m.role === 'admin' ? 'адмін' : 'учасник' }}
                      </span>
                    }
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-500">Список учасників порожній або API не повертає members у відповіді.</p>
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
  private readonly teamsApi = inject(TeamsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  renameTeamName = '';
  renamingTeam = false;
  renameTeamError: string | null = null;

  inviteQuery = '';
  inviteCandidates: TeamInviteCandidate[] = [];
  inviteSearchLoading = false;
  inviteAddLoading = false;
  inviteSearchError: string | null = null;
  inviteSuccessMessage: string | null = null;
  inviteSearchBlocked403 = false;

  private teamId: string | null = null;
  private readonly inviteQueryChanges = new Subject<string>();

  removing: string | null = null;
  roleUpdating: string | null = null;

  constructor() {
    this.inviteQueryChanges
      .pipe(
        debounceTime(400),
        map((q) => q.trim()),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!this.teamId || this.inviteSearchBlocked403) {
            this.inviteSearchLoading = false;
            return of([]);
          }

          if (q.length < 2) {
            this.inviteSearchLoading = false;
            this.inviteCandidates = [];
            this.inviteSearchError = null;
            return of([]);
          }

          this.inviteSearchLoading = true;
          this.inviteSearchError = null;
          return this.teamsApi.inviteSearch(this.teamId, q, 10).pipe(
            catchError((err: HttpErrorResponse) => {
              if (err.status === 403) {
                this.inviteSearchBlocked403 = true;
              }
              this.inviteSearchError = err.error?.message ? String(err.error.message) : 'Не вдалося виконати пошук';
              this.inviteCandidates = [];
              return of([]);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((candidates) => {
        this.inviteCandidates = candidates;
        this.inviteSearchLoading = false;
      });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('teamId')),
        filter((id): id is string => !!id),
      )
      .subscribe((id) => {
        this.teamId = id;
        this.inviteQuery = '';
        this.inviteCandidates = [];
        this.inviteSearchError = null;
        this.inviteSuccessMessage = null;
        this.inviteSearchBlocked403 = false;
        this.renameTeamError = null;
        void this.teamStore.loadTeamDetail(id);
      });
  }

  ngOnDestroy(): void {
    this.teamStore.clearActiveTeam();
  }

  async renameTeam(teamId: string, currentName: string): Promise<void> {
    const next = this.renameTeamName.trim();
    if (!next || next === currentName || this.renamingTeam) {
      return;
    }
    this.renamingTeam = true;
    this.renameTeamError = null;
    try {
      const ok = await this.teamStore.renameTeam(teamId, next);
      if (!ok) {
        this.renameTeamError = this.teamStore.error() ?? 'Не вдалося перейменувати команду';
        this.toast.show(this.renameTeamError, 'error');
        return;
      }
      this.renameTeamName = next;
      this.toast.show('Назву команди оновлено', 'success');
    } finally {
      this.renamingTeam = false;
    }
  }

  onInviteQueryChange(next: string): void {
    this.inviteSuccessMessage = null;
    this.inviteSearchError = null;
    if (this.inviteSearchBlocked403) {
      return;
    }
    this.inviteQueryChanges.next(next);
  }

  async inviteMember(teamId: string, candidate: TeamInviteCandidate): Promise<void> {
    if (!candidate?.id || this.inviteAddLoading) {
      return;
    }

    this.inviteAddLoading = true;
    try {
      const ok = await this.teamStore.addMember(teamId, candidate.id);
      if (ok) {
        const label = candidate.name || candidate.email || candidate.id;
        this.inviteSuccessMessage = `Користувач ${label} успішно доданий до команди`;
        this.inviteQuery = '';
        this.inviteCandidates = [];
      } else {
        // Очистимо помилку в store, щоб не ховати UI інвайту.
        void this.teamStore.loadTeamDetail(teamId);
      }
    } finally {
      this.inviteAddLoading = false;
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
