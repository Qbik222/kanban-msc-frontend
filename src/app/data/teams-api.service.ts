import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Team, TeamInviteCandidate, TeamMemberDto, TeamMemberRole } from '../models/team.models';

@Injectable({ providedIn: 'root' })
export class TeamsApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.api}/teams`);
  }

  createTeam(body: { name: string }): Observable<Team> {
    return this.http.post<Team>(`${this.api}/teams`, body);
  }

  patchTeam(teamId: string, body: { name: string }): Observable<Team> {
    return this.http.patch<Team>(`${this.api}/teams/${teamId}`, body);
  }

  /** Optional detail with members; use if backend exposes GET /teams/:id. */
  getTeam(teamId: string): Observable<Team> {
    return this.http.get<Team>(`${this.api}/teams/${teamId}`);
  }

  /** Members list (backend: GET /teams/:teamId/members) */
  listTeamMembers(teamId: string): Observable<TeamMemberDto[]> {
    return this.http.get<TeamMemberDto[]>(`${this.api}/teams/${teamId}/members`);
  }

  addMember(teamId: string, body: { userId: string }): Observable<unknown> {
    return this.http.post(`${this.api}/teams/${teamId}/members`, body);
  }

  patchMemberRole(teamId: string, userId: string, body: { role: TeamMemberRole }): Observable<unknown> {
    return this.http.patch(`${this.api}/teams/${teamId}/members/${userId}`, body);
  }

  removeMember(teamId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/teams/${teamId}/members/${userId}`);
  }

  inviteSearch(teamId: string, query: string, limit: number = 10): Observable<TeamInviteCandidate[]> {
    // Backend should return only candidates eligible to be invited (backend controls "can/ cannot invite").
    return this.http.get<TeamInviteCandidate[]>(`${this.api}/teams/${teamId}/invite-search`, {
      params: {
        query,
        limit: String(limit),
      },
    });
  }
}
