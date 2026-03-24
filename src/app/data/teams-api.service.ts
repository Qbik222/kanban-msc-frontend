import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Team, TeamMemberRole } from '../models/team.models';

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

  /** Optional detail with members; use if backend exposes GET /teams/:id. */
  getTeam(teamId: string): Observable<Team> {
    return this.http.get<Team>(`${this.api}/teams/${teamId}`);
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
}
