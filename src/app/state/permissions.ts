/** Mirrors backend/permissions.md role matrix (non-owner defaults to viewer until API exposes role). */
export type BoardRole = 'owner' | 'editor' | 'viewer';

export const ROLE_PERMISSIONS: Record<BoardRole, readonly string[]> = {
  owner: [
    'board:create',
    'board:list',
    'board:read',
    'board:update',
    'board:delete',
    'column:create',
    'column:update',
    'column:reorder',
    'column:delete',
    'card:create',
    'card:update',
    'card:move',
    'card:delete',
    'comment:create',
    'comment:delete:any',
    'comment:delete:own',
    'member:invite',
    'member:update_role',
    'member:remove',
  ],
  editor: [
    'board:create',
    'board:list',
    'board:read',
    'board:update',
    'column:create',
    'column:update',
    'column:reorder',
    'column:delete',
    'card:create',
    'card:update',
    'card:move',
    'card:delete',
    'comment:create',
    'comment:delete:any',
    'comment:delete:own',
    'member:invite',
    'member:remove',
  ],
  viewer: [
    'board:list',
    'board:read',
    'comment:create',
    'comment:delete:own',
  ],
};

export function roleHasAnyPermission(role: BoardRole, keys: string[]): boolean {
  const set = new Set(ROLE_PERMISSIONS[role]);
  return keys.some((k) => set.has(k));
}
