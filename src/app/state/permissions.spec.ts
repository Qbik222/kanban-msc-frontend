import { ROLE_PERMISSIONS } from './permissions';

function setEq(a: string[], b: string[]): boolean {
  const as = new Set(a);
  const bs = new Set(b);
  if (as.size !== bs.size) {
    return false;
  }
  for (const v of as) {
    if (!bs.has(v)) {
      return false;
    }
  }
  return true;
}

describe('ROLE_PERMISSIONS (sync with docs/permissions.md)', () => {
  it('matches docs matrix for owner/editor/viewer', () => {
    // Source of truth: docs/permissions.md
    const expected = {
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
    } as const;

    expect(setEq([...ROLE_PERMISSIONS.owner], [...expected.owner])).toBeTrue();
    expect(setEq([...ROLE_PERMISSIONS.editor], [...expected.editor])).toBeTrue();
    expect(setEq([...ROLE_PERMISSIONS.viewer], [...expected.viewer])).toBeTrue();
  });
});

