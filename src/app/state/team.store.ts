import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TeamsApiService } from '../data/teams-api.service';
import { Team, TeamMember, TeamMemberDto, TeamMemberRole } from '../models/team.models';

interface TeamState {
  teams: Team[];
  /** Loaded detail (e.g. members) for team detail route */
  activeTeam: Team | null;
  loading: boolean;
  error: string | null;
  /** Filter boards list by team; null = all teams */
  selectedTeamFilterId: string | null;
}

const initialState: TeamState = {
  teams: [],
  activeTeam: null,
  loading: false,
  error: null,
  selectedTeamFilterId: null,
};

export const TeamStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const teamNameById = computed(() => {
      const m = new Map<string, string>();
      for (const t of store.teams()) {
        m.set(t.id, t.name);
      }
      return m;
    });
    const hasAdminTeam = computed(() => store.teams().some((t) => t.role === 'admin'));
    const adminTeams = computed(() => store.teams().filter((t) => t.role === 'admin'));
    return { teamNameById, hasAdminTeam, adminTeams };
  }),
  withMethods((store, api = inject(TeamsApiService)) => {
    const mapTeamMemberDtoToTeamMember = (m: TeamMemberDto): TeamMember => ({
      userId: m.id,
      role: m.role,
      name: m.name,
      email: m.email,
      boards: m.boards,
    });

    const refreshTeamAndList = async (teamId: string): Promise<void> => {
      const [team, teams, teamMembers] = await Promise.all([
        firstValueFrom(api.getTeam(teamId)),
        firstValueFrom(api.listTeams()),
        firstValueFrom(api.listTeamMembers(teamId)),
      ]);
      const mappedMembers = teamMembers.map(mapTeamMemberDtoToTeamMember);
      const mappedTeam: Team = { ...team, members: mappedMembers };
      const currentActiveTeam = store.activeTeam();
      patchState(store, {
        teams,
        activeTeam: currentActiveTeam?.id === teamId ? mappedTeam : currentActiveTeam,
      });
    };

    return {
    setSelectedTeamFilterId(id: string | null): void {
      patchState(store, { selectedTeamFilterId: id });
    },
    reset(): void {
      patchState(store, initialState);
    },
    isTeamAdmin(teamId: string | undefined): boolean {
      if (!teamId) {
        return false;
      }
      return store.teams().find((t) => t.id === teamId)?.role === 'admin';
    },
    teamRole(teamId: string | undefined): TeamMemberRole | undefined {
      if (!teamId) {
        return undefined;
      }
      return store.teams().find((t) => t.id === teamId)?.role;
    },
    async loadTeams(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const teams = await firstValueFrom(api.listTeams());
        patchState(store, { teams, loading: false });
      } catch (e) {
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load teams',
        });
      }
    },
    async createTeam(name: string): Promise<Team | null> {
      const trimmed = name.trim();
      if (!trimmed) {
        return null;
      }
      patchState(store, { loading: true, error: null });
      try {
        const team = await firstValueFrom(api.createTeam({ name: trimmed }));
        patchState(store, {
          teams: [...store.teams(), team],
          loading: false,
        });
        return team;
      } catch (e) {
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to create team',
        });
        return null;
      }
    },
    async loadTeamDetail(teamId: string): Promise<void> {
      patchState(store, { loading: true, error: null, activeTeam: null });
      try {
        const [team, teamMembers] = await Promise.all([
          firstValueFrom(api.getTeam(teamId)),
          firstValueFrom(api.listTeamMembers(teamId)),
        ]);
        const mappedMembers = teamMembers.map(mapTeamMemberDtoToTeamMember);
        const mappedTeam: Team = { ...team, members: mappedMembers };
        patchState(store, { activeTeam: mappedTeam, loading: false });
      } catch (e) {
        patchState(store, {
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to load team',
        });
      }
    },
    async addMember(teamId: string, userId: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.addMember(teamId, { userId: userId.trim() }));
        await refreshTeamAndList(teamId);
        return true;
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e.message : 'Failed to add member',
        });
        return false;
      }
    },
    async patchMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.patchMemberRole(teamId, userId, { role }));
        await refreshTeamAndList(teamId);
        return true;
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e.message : 'Failed to update member',
        });
        return false;
      }
    },
    async removeMember(teamId: string, userId: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.removeMember(teamId, userId));
        await refreshTeamAndList(teamId);
        return true;
      } catch (e) {
        patchState(store, {
          error: e instanceof Error ? e.message : 'Failed to remove member',
        });
        return false;
      }
    },
    clearActiveTeam(): void {
      patchState(store, { activeTeam: null });
    },
    };
  }),
);
