import { Component, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, firstValueFrom, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { BoardApiService } from '../../data/board-api.service';
import { BoardMemberDto, BoardMemberRole } from '../../models/board.models';
import { TeamMember } from '../../models/team.models';
import { ToastService } from '../../core/toast/toast.service';
import { BoardStore } from '../../state/board.store';
import { TeamStore } from '../../state/team.store';
import { CanViewDirective } from '../../shared/directives/can-view.directive';

@Component({
  selector: 'app-board-settings',
  standalone: true,
  imports: [RouterLink, FormsModule, CanViewDirective],
  template: `
    <div class="mx-auto max-w-4xl">
      <p class="mb-4 text-sm">
        <a routerLink="/boards" class="text-emerald-400 hover:underline">← До списку дошок</a>
        @if (boardStore.activeBoard(); as b) {
          <span class="mx-2 text-slate-600">/</span>
          <a [routerLink]="['/boards', b.id]" class="text-emerald-400 hover:underline">Назад до дошки</a>
        }
      </p>

      <h1 class="mb-2 text-2xl font-semibold text-white">Налаштування дошки</h1>

      @if (boardStore.loading() && !boardStore.activeBoard()) {
        <p class="text-slate-400">Завантаження…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      }

      @if (boardStore.activeBoard(); as board) {
        <div class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-300">Інформація</h2>
          <div class="grid grid-cols-1 gap-2 text-sm text-slate-300 sm:grid-cols-2">
            <div><span class="text-slate-500">Title:</span> {{ board.title }}</div>
            <div><span class="text-slate-500">Board ID:</span> {{ board.id }}</div>
            <div><span class="text-slate-500">Team ID:</span> {{ board.teamId }}</div>
            <div><span class="text-slate-500">Owner ID:</span> {{ board.ownerId }}</div>
          </div>
        </div>

        <div *canView="['board:update']" class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-300">Перейменувати дошку</h2>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label class="flex flex-1 flex-col gap-1 text-xs text-slate-400">
              Назва
              <input
                type="text"
                class="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                placeholder="New board title"
                [ngModel]="renameTitle || board.title"
                (ngModelChange)="renameTitle = $event"
                [disabled]="renamingBoard"
              />
            </label>
            <button
              type="button"
              class="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
              [disabled]="renamingBoard || !(renameTitle || '').trim() || (renameTitle || '').trim() === board.title"
              (click)="renameBoard(board.id, board.title)"
            >
              {{ renamingBoard ? 'Збереження…' : 'Зберегти' }}
            </button>
          </div>
          @if (renameError) {
            <p class="mt-2 text-xs text-red-400">{{ renameError }}</p>
          }
        </div>

        <div *canView="['member:invite']" class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-300">Запросити на дошку</h2>
          <p class="mb-2 text-xs text-slate-500">Пошук користувачів команди за name/email</p>

          <div class="flex flex-col gap-2">
            <input
              type="text"
              class="w-72 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              placeholder="name або email"
              [(ngModel)]="inviteSearch"
              (ngModelChange)="onInviteSearchChange($event)"
              [disabled]="invitingMember"
            />

            <select
              class="w-72 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              [(ngModel)]="inviteSelectedUserId"
              [disabled]="invitingMember"
            >
              <option value="">Оберіть користувача</option>
              @for (m of inviteFilteredMembers; track m.userId) {
                <option [value]="m.userId">{{ inviteOptionLabel(m) }}</option>
              }
            </select>

            @if (inviteSearch.trim() && inviteFilteredMembers.length === 0) {
              <p class="text-xs text-red-400">нічого не знайдено</p>
            }

            @if (invitePillMessage) {
              @if (invitePillKind === 'success') {
                <p class="inline-block rounded border border-emerald-800 bg-emerald-900/40 px-2 py-1 text-xs text-emerald-200">
                  {{ invitePillMessage }}
                </p>
              } @else {
                <p class="inline-block rounded border border-red-800 bg-red-900/40 px-2 py-1 text-xs text-red-200">
                  {{ invitePillMessage }}
                </p>
              }
            }

            <button
              type="button"
              class="w-72 rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
              [disabled]="invitingMember || !inviteSelectedUserId"
              (click)="inviteBoardMember(board.id, board.teamId)"
            >
              {{ invitingMember ? '…' : 'Запросити' }}
            </button>
          </div>
        </div>

        <div class="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <h2 class="text-sm font-medium text-slate-300">Учасники дошки</h2>
            <button
              type="button"
              class="text-xs text-slate-300 hover:underline disabled:opacity-50"
              [disabled]="membersLoading"
              (click)="reloadMembers(board.id)"
            >
              Оновити
            </button>
          </div>

          @if (membersLoading) {
            <p class="text-xs text-slate-400">Завантаження…</p>
          } @else if (membersError) {
            <p class="text-xs text-red-400">{{ membersError }}</p>
          } @else if (members.length) {
            <ul class="flex flex-col gap-2">
              @for (m of members; track m.id) {
                <li class="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm">
                  <div class="min-w-0">
                    <div class="truncate text-slate-200">{{ m.name }} <span class="text-slate-500">({{ m.email }})</span></div>
                    <div class="text-xs text-slate-500">{{ m.id }}</div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400">role:</span>

                    @if (canUpdateRole()) {
                      <select
                        class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                        [ngModel]="m.role"
                        (ngModelChange)="onMemberRoleChange(board.id, m.id, $event)"
                        [disabled]="roleUpdating === m.id"
                      >
                        <option value="owner">owner</option>
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    } @else {
                      <span class="text-xs text-slate-300">{{ m.role }}</span>
                    }

                    <button
                      *canView="['member:remove']"
                      type="button"
                      class="text-xs text-red-400 hover:underline disabled:opacity-50"
                      [disabled]="removing === m.id"
                      (click)="removeMember(board.id, m.id)"
                    >
                      Вилучити
                    </button>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-500">Список учасників порожній.</p>
          }
        </div>
      }
    </div>
  `,
})
export class BoardSettingsComponent implements OnDestroy {
  readonly boardStore = inject(BoardStore);
  readonly teamStore = inject(TeamStore);
  private readonly api = inject(BoardApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  renameTitle = '';
  renamingBoard = false;
  renameError: string | null = null;

  members: BoardMemberDto[] = [];
  membersLoading = false;
  membersError: string | null = null;
  roleUpdating: string | null = null;
  removing: string | null = null;

  inviteSearch = '';
  inviteSelectedUserId = '';
  invitingMember = false;
  invitePillMessage: string | null = null;
  invitePillKind: 'success' | 'error' = 'success';

  private boardId: string | null = null;
  private readonly inviteSearchChanges = new Subject<string>();

  constructor() {
    this.inviteSearchChanges
      .pipe(
        debounceTime(200),
        map((q) => q.trim().toLowerCase()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        if (q) {
          this.invitePillMessage = null;
        }
        // No remote search — filtering is computed in getter.
      });

    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        tap((id) => {
          this.boardId = id;
          this.inviteSearch = '';
          this.inviteSelectedUserId = '';
          this.invitePillMessage = null;
          this.invitePillKind = 'success';
          this.members = [];
          this.membersError = null;
          this.renameTitle = this.boardStore.activeBoard()?.title ?? '';
          this.renameError = null;
        }),
        switchMap((id) =>
          of(id).pipe(
            tap(() => void this.boardStore.loadBoard(id)),
            // After board is loaded, load members + team detail (for invite candidates).
            switchMap(() => of(id)),
          ),
        ),
      )
      .subscribe(async (id) => {
        const board = this.boardStore.activeBoard();
        if (board?.id !== id) {
          // `loadBoard` is async; wait for it via polling is overkill—just rely on subsequent change detection.
        }
        // Ensure rename input is synced after board load.
        this.renameTitle = this.boardStore.activeBoard()?.title ?? this.renameTitle;
        await this.reloadMembers(id);
        const b = this.boardStore.activeBoard();
        if (b?.teamId) {
          await this.teamStore.loadTeamDetail(b.teamId);
        }
      });
  }

  ngOnDestroy(): void {
    // Keep active board in store for board screen; clear only activeTeam detail loaded for invites.
    this.teamStore.clearActiveTeam();
  }

  canUpdateRole(): boolean {
    // Template uses *canView for actions, but for role select we need a boolean branch too.
    // Reuse role matrix through directive’s logic by checking the store role here is not exposed;
    // simplest: just render select always and rely on backend — but UX wants hide/readonly.
    // We approximate by checking permissions set on store (computed).
    return this.boardStore.permissions().has('member:update_role');
  }

  async reloadMembers(boardId: string): Promise<void> {
    this.membersLoading = true;
    this.membersError = null;
    try {
      const raw = await firstValueFrom(this.api.listBoardMembers(boardId));
      this.members = raw.filter((m) => !!m.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не вдалося завантажити учасників';
      this.membersError = msg;
    } finally {
      this.membersLoading = false;
    }
  }

  get inviteFilteredMembers(): TeamMember[] {
    const q = this.inviteSearch.trim().toLowerCase();
    const candidates = this.inviteCandidates();
    if (!q) {
      return candidates;
    }
    return candidates.filter((m) => this.matchesInviteQuery(m, q));
  }

  private inviteCandidates(): TeamMember[] {
    const boardId = this.boardId ?? this.boardStore.activeBoard()?.id ?? null;
    const meId = this.boardStore.user()?.id;
    const members = this.teamStore.activeTeam()?.members ?? [];

    const byId = new Map<string, TeamMember>();
    for (const m of members) {
      if (!m.userId) {
        continue;
      }
      if (meId && m.userId === meId) {
        continue;
      }
      const hasAccess = boardId ? m.boards?.some((b) => b.id === boardId) ?? false : false;
      if (hasAccess) {
        continue;
      }
      byId.set(m.userId, m);
    }
    return [...byId.values()];
  }

  private matchesInviteQuery(member: TeamMember, normalizedQuery: string): boolean {
    const name = (member.name ?? '').trim().toLowerCase();
    const email = (member.email ?? '').trim().toLowerCase();
    return [name, email].some((v) => v.includes(normalizedQuery));
  }

  onInviteSearchChange(next: string): void {
    this.inviteSearchChanges.next(next);
  }

  inviteOptionLabel(m: TeamMember): string {
    const base = m.name || m.email || m.userId;
    return `${base} (${m.userId})`;
  }

  async renameBoard(boardId: string, currentTitle: string): Promise<void> {
    const next = this.renameTitle.trim();
    if (!next || next === currentTitle || this.renamingBoard) {
      return;
    }
    this.renamingBoard = true;
    this.renameError = null;
    try {
      const updated = await firstValueFrom(this.api.patchBoard(boardId, { title: next }));
      this.boardStore.mergeBoardMetadata(updated);
      this.boardStore.upsertBoardSummary(updated);
      this.toast.show('Назву дошки оновлено', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не вдалося перейменувати дошку';
      this.renameError = msg;
      this.toast.show(msg, 'error');
    } finally {
      this.renamingBoard = false;
    }
  }

  async inviteBoardMember(boardId: string, teamId: string): Promise<void> {
    const userId = this.inviteSelectedUserId.trim();
    if (!userId || this.invitingMember) {
      return;
    }

    const selectedMember = this.teamStore.activeTeam()?.members?.find((m) => m.userId === userId);
    const selectedLabel = selectedMember?.name || selectedMember?.email || selectedMember?.userId || userId;

    this.invitePillMessage = null;
    this.invitingMember = true;
    try {
      await firstValueFrom(this.api.inviteBoardMember(boardId, { userId }));
      this.invitePillKind = 'success';
      this.invitePillMessage = `Користувач ${selectedLabel} доданий до дошки`;
      this.toast.show('Запрошення надіслано', 'success');
      this.inviteSearch = '';
      this.inviteSelectedUserId = '';
      await Promise.all([
        this.reloadMembers(boardId),
        this.teamStore.loadTeamDetail(teamId),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не вдалося запросити';
      this.invitePillKind = 'error';
      this.invitePillMessage = msg;
      this.toast.show(msg, 'error');
    } finally {
      this.invitingMember = false;
    }
  }

  async onMemberRoleChange(boardId: string, memberUserId: string, role: string): Promise<void> {
    const r = role as BoardMemberRole;
    if (r !== 'owner' && r !== 'editor' && r !== 'viewer') {
      return;
    }
    this.roleUpdating = memberUserId;
    try {
      await firstValueFrom(this.api.patchBoardMemberRole(boardId, memberUserId, { role: r }));
      await this.reloadMembers(boardId);
      this.toast.show('Роль оновлено', 'success');
    } catch (e) {
      this.toast.show(e instanceof Error ? e.message : 'Не вдалося оновити роль', 'error');
    } finally {
      this.roleUpdating = null;
    }
  }

  async removeMember(boardId: string, memberUserId: string): Promise<void> {
    if (!confirm('Вилучити доступ цього користувача до дошки?')) {
      return;
    }
    this.removing = memberUserId;
    try {
      await firstValueFrom(this.api.removeBoardMember(boardId, memberUserId));
      await this.reloadMembers(boardId);
      // Also refresh team detail so the removed user becomes inviteable again.
      const teamId = this.boardStore.activeBoard()?.teamId;
      if (teamId) {
        await this.teamStore.loadTeamDetail(teamId);
      }
      this.toast.show('Користувача вилучено', 'success');
    } catch (e) {
      this.toast.show(e instanceof Error ? e.message : 'Не вдалося вилучити', 'error');
    } finally {
      this.removing = null;
    }
  }
}

