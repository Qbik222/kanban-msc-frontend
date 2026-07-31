import { Component, OnDestroy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '../../../state/team.store';
import { TeamsApiService } from '../../../data/teams-api.service';
import { TeamInviteCandidate, TeamMemberRole } from '../../../models/team.models';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastService } from '../../../core/toast/toast.service';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-team-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './team-detail.component.html',
  styleUrl: './team-detail.component.scss',
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
              this.inviteSearchError = err.error?.message ? String(err.error.message) : 'Search failed';
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
        this.renameTeamError = this.teamStore.error() ?? 'Failed to rename team';
        this.toast.show(this.renameTeamError, 'error');
        return;
      }
      this.renameTeamName = next;
      this.toast.show('Team name updated', 'success');
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
        this.inviteSuccessMessage = `User ${label} was added to the team`;
        this.inviteQuery = '';
        this.inviteCandidates = [];
      } else {
        // Reload team detail so invite UI is not hidden by a stale store error.
        void this.teamStore.loadTeamDetail(teamId);
      }
    } finally {
      this.inviteAddLoading = false;
    }
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    if (!confirm('Remove this member from the team?')) {
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
