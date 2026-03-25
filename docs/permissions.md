# Permissions Model

## Teams

- Team roles: **`admin`**, **`user`** (see `TeamMember`).
- **`admin`** of a team is treated as having **every board permission** on **all boards** in that team (no `BoardMember` row required).
- **`user`** of a team only accesses boards where they are **`owner`** or have a **`BoardMember`** row; board roles below (`owner` / `editor` / `viewer`) then apply.
- Board invites (`POST /boards/:boardId/members`) are allowed only for users who are already members of the **same team** as the board.
- **`POST /boards`**: body must include **`teamId`**; the guard allows creation only if the caller is **team `admin`** for that `teamId` (in addition to the `board:create` permission flag on the route).
- Team payloads from **`POST /teams`**, **`GET /teams`**, and **`GET /teams/:teamId`** include **`role`** (`admin` \| `user`) for the authenticated user in that team.

## Board roles

- `owner`: full board administration and content management.
- `editor`: content management and limited member management.
- `viewer`: read-only board access with comments support.

## Permissions Catalog

- Board: `board:create`, `board:list`, `board:read`, `board:update`, `board:delete`
- Columns: `column:create`, `column:update`, `column:reorder`, `column:delete`
- Cards: `card:create`, `card:update`, `card:move`, `card:delete`
- Comments: `comment:create`, `comment:delete:any`, `comment:delete:own`
- Members: `member:invite`, `member:update_role`, `member:remove`

## Role -> Permission Matrix

| Permission | owner | editor | viewer |
| --- | --- | --- | --- |
| `board:create` | ✅ | ✅ | ✅ |
| `board:list` | ✅ | ✅ | ✅ |
| `board:read` | ✅ | ✅ | ✅ |
| `board:update` | ✅ | ✅ | ❌ |
| `board:delete` | ✅ | ❌ | ❌ |
| `column:create` | ✅ | ✅ | ❌ |
| `column:update` | ✅ | ✅ | ❌ |
| `column:reorder` | ✅ | ✅ | ❌ |
| `column:delete` | ✅ | ✅ | ❌ |
| `card:create` | ✅ | ✅ | ❌ |
| `card:update` | ✅ | ✅ | ❌ |
| `card:move` | ✅ | ✅ | ❌ |
| `card:delete` | ✅ | ✅ | ❌ |
| `comment:create` | ✅ | ✅ | ✅ |
| `comment:delete:any` | ✅ | ✅ | ❌ |
| `comment:delete:own` | ✅ | ✅ | ✅ |
| `member:invite` | ✅ | ✅ | ❌ |
| `member:update_role` | ✅ | ❌ | ❌ |
| `member:remove` | ✅ | ✅ | ❌ |

The `board:create` row reflects the permission bit used on **`POST /boards`** together with **team admin** checks for `teamId`; board-level roles alone do not grant creating new boards.

## Endpoint -> Required Permission

### Teams

- `POST /teams` -> authenticated (creator becomes team `admin`)
- `GET /teams` -> authenticated
- `GET /teams/:teamId` -> authenticated member of that team (otherwise 404)
- `POST /teams/:teamId/members` -> team `admin`
- `PATCH /teams/:teamId/members/:memberUserId/role` -> team `admin`
- `DELETE /teams/:teamId/members/:memberUserId` -> team `admin`

### Boards

- `POST /boards` -> `board:create` + **team `admin`** for `body.teamId`
- `GET /boards` -> `board:list`
- `GET /boards/:id` -> `board:read`
- `PATCH /boards/:id` -> `board:update`
- `DELETE /boards/:id` -> `board:delete`
- `POST /boards/:boardId/members` -> `member:invite`
- `PATCH /boards/:boardId/members/:memberUserId/role` -> `member:update_role`
- `DELETE /boards/:boardId/members/:memberUserId` -> `member:remove`

### Columns

- `POST /columns` -> `column:create`
- `PATCH /columns/reorder` -> `column:reorder`
- `PATCH /columns/:id` -> `column:update`
- `DELETE /columns/:id` -> `column:delete`

### Cards

- `POST /cards` -> `card:create`
- `PATCH /cards/:id` -> `card:update`
- `PATCH /cards/:id/move` -> `card:move`
- `DELETE /cards/:id` -> `card:delete`
- `POST /cards/:id/comments` -> `comment:create`
- `DELETE /cards/:id/comments/:commentId` -> `comment:delete:any` or `comment:delete:own`

### WebSocket

- `joinBoard` -> `board:read`

## Invariants

- The last `owner` cannot be removed or demoted.
- `editor` cannot update roles.
- `editor` cannot remove `owner`.
- `viewer` cannot modify board structure or cards.
- Comment delete is allowed when:
  - user has `comment:delete:any`, or
  - user has `comment:delete:own` and is comment author.

## Rollout Checklist

- [x] Board membership (`BoardMember`) and owner auto-membership.
- [x] Centralized role/permission policy map.
- [x] Guard + decorator permission enforcement.
- [x] Endpoint permission migration (`boards`, `columns`, `cards`).
- [x] WebSocket `joinBoard` permission check.
- [x] Member management endpoints.
- [x] Card soft delete endpoint.
- [x] E2E coverage for role-based access cases.
