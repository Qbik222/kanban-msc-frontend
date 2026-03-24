/** Team membership role (backend: admin | user). */
export type TeamMemberRole = 'admin' | 'user';

export interface TeamMember {
  userId: string;
  role: TeamMemberRole;
  name?: string;
  email?: string;
}

/** Team as returned by GET /teams or GET /teams/:id. `role` is the current user's role in this team. */
export interface Team {
  id: string;
  name: string;
  role: TeamMemberRole;
  members?: TeamMember[];
}
