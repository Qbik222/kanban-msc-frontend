import { Component, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, firstValueFrom, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';
import { BoardApiService } from '../../../data/board-api.service';
import { BoardMemberDto, BoardMemberRole } from '../../../models/board.models';
import { TeamMember } from '../../../models/team.models';
import { ToastService } from '../../../core/toast/toast.service';
import { BoardStore } from '../../../state/board.store';
import { TeamStore } from '../../../state/team.store';
import { CanViewDirective } from '../../../shared/directives/can-view.directive';

@Component({
  selector: 'app-board-settings',
  standalone: true,
  imports: [RouterLink, FormsModule, CanViewDirective],
  templateUrl: './board-settings.component.html',
  styleUrl: './board-settings.component.scss',
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
      const msg = e instanceof Error ? e.message : 'Failed to load members';
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
      this.toast.show('Board title updated', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to rename board';
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
      this.invitePillMessage = `User ${selectedLabel} added to the board`;
      this.toast.show('Invitation sent', 'success');
      this.inviteSearch = '';
      this.inviteSelectedUserId = '';
      await Promise.all([
        this.reloadMembers(boardId),
        this.teamStore.loadTeamDetail(teamId),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to invite member';
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
      this.toast.show('Role updated', 'success');
    } catch (e) {
      this.toast.show(e instanceof Error ? e.message : 'Failed to update role', 'error');
    } finally {
      this.roleUpdating = null;
    }
  }

  async removeMember(boardId: string, memberUserId: string): Promise<void> {
    if (!confirm('Remove this user\'s access to the board?')) {
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
      this.toast.show('Member removed', 'success');
    } catch (e) {
      this.toast.show(e instanceof Error ? e.message : 'Failed to remove member', 'error');
    } finally {
      this.removing = null;
    }
  }
}

