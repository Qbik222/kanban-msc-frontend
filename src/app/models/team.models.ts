/** Team membership role (backend: admin | user). */
export type TeamMemberRole = 'admin' | 'user';

export interface BoardRef {
  id: string;
  title?: string;
}

export interface TeamMember {
  userId: string;
  role: TeamMemberRole;
  name?: string;
  email?: string;
  /** Boards where this user already has access (backend-provided). */
  boards?: BoardRef[];
}

/** DTO returned by `GET /teams/:teamId/members` (id is backend member id). */
export interface TeamMemberDto {
  id: string;
  role: TeamMemberRole;
  name?: string;
  email?: string;
  /** Boards where this user already has access (backend-provided). */
  boards?: BoardRef[];
}

/** Candidate returned by GET /teams/:teamId/invite-search */
export interface TeamInviteCandidate {
  id: string;
  email: string;
  name?: string;
}

/** Team as returned by GET /teams or GET /teams/:id. `role` is the current user's role in this team. */
export interface Team {
  id: string;
  name: string;
  role: TeamMemberRole;
  members?: TeamMember[];
}
