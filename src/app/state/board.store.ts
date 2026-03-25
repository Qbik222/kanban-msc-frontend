import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { BoardApiService } from '../data/board-api.service';
import { BoardDetails, BoardSummary, Card, Column, UserProfile } from '../models/board.models';
import { BoardRole, ROLE_PERMISSIONS, roleHasAnyPermission } from './permissions';
import { TeamStore } from './team.store';

function sortColumns(cols: Column[]): Column[] {
  return [...cols].sort((a, b) => a.order - b.order);
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.order - b.order);
}

/** Sort columns and card arrays once when ingesting API/socket data (stable refs for CDK drop lists). */
function normalizeBoard(board: BoardDetails): BoardDetails {
  const next = structuredClone(board);
  for (const col of next.columns) {
    col.cards = sortCards(col.cards);
  }
  next.columns = sortColumns(next.columns);
  return next;
}

function cloneBoard(board: BoardDetails): BoardDetails {
  return structuredClone(board);
}

function applyCardMove(
  board: BoardDetails,
  cardId: string,
  targetColumnId: string,
  newIndex: number,
): BoardDetails {
  const next = cloneBoard(board);
  let moved: Card | undefined;
  let sourceCol: Column | undefined;
  for (const col of next.columns) {
    const idx = col.cards.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      moved = col.cards[idx];
      sourceCol = col;
      col.cards.splice(idx, 1);
      break;
    }
  }
  if (!moved) {
    return next;
  }
  const targetCol = next.columns.find((c) => c.id === targetColumnId);
  if (!targetCol) {
    return board;
  }
  moved.columnId = targetColumnId;
  const clamped = Math.max(0, Math.min(newIndex, targetCol.cards.length));
  targetCol.cards.splice(clamped, 0, moved);
  const renumber = (col: Column) => {
    col.cards = sortCards(col.cards);
    col.cards.forEach((c, i) => c.order = i);
  };
  if (sourceCol && sourceCol.id !== targetCol.id) {
    renumber(sourceCol);
  }
  renumber(targetCol);
  return next;
}

interface BoardState {
  boards: BoardSummary[];
  activeBoard: BoardDetails | null;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  /** Board role for the current user as inferred from BoardMember list (null = unknown / not loaded). */
  activeBoardMemberRole: BoardRole | null;
}

const initialState: BoardState = {
  boards: [],
  activeBoard: null,
  user: null,
  loading: false,
  error: null,
  activeBoardMemberRole: null,
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const teamStore = inject(TeamStore);
    const isOwner = computed(() => {
      const u = store.user();
      const b = store.activeBoard();
      return !!(u && b && u.id === b.ownerId);
    });
    /** Team admin has full board rights on the backend without board membership; mirror as owner for UI. */
    const isTeamAdminForActiveBoard = computed(() => {
      const b = store.activeBoard();
      return teamStore.isTeamAdmin(b?.teamId);
    });
    const effectiveRole = computed((): BoardRole => {
      if (isTeamAdminForActiveBoard() || isOwner()) {
        return 'owner';
      }
      // Board member role is loaded from GET /boards/:boardId/members and mapped to BoardRole.
      // Fallback is viewer to match docs/permissions.md.
      return store.activeBoardMemberRole() ?? 'viewer';
    });
    const permissions = computed(() => {
      const role = effectiveRole();
      return new Set(ROLE_PERMISSIONS[role]);
    });
    const canEdit = computed(() =>
      roleHasAnyPermission(effectiveRole(), ['card:update', 'board:update']),
    );
    const canMoveCards = computed(() => roleHasAnyPermission(effectiveRole(), ['card:move']));
    const canCreateColumn = computed(() => roleHasAnyPermission(effectiveRole(), ['column:create']));
    const canCreateCard = computed(() => roleHasAnyPermission(effectiveRole(), ['card:create']));
    const canComment = computed(() => roleHasAnyPermission(effectiveRole(), ['comment:create']));
    const sortedColumns = computed(() => {
      const b = store.activeBoard();
      if (!b) {
        return [];
      }
      return sortColumns(b.columns);
    });
    return {
      isOwner,
      effectiveRole,
      permissions,
      canEdit,
      canMoveCards,
      canCreateColumn,
      canCreateCard,
      canComment,
      sortedColumns,
    };
  }),
  withMethods(
    (
      store,
      api = inject(BoardApiService),
    ) => ({
      setActiveBoardMemberRole(role: BoardRole | null): void {
        patchState(store, { activeBoardMemberRole: role });
      },
      setUser(user: UserProfile | null): void {
        patchState(store, { user });
      },
      setLoading(loading: boolean): void {
        patchState(store, { loading });
      },
      setError(error: string | null): void {
        patchState(store, { error });
      },
      setActiveBoard(board: BoardDetails | null): void {
        patchState(store, { activeBoard: board, activeBoardMemberRole: null });
      },
      replaceBoards(boards: BoardSummary[]): void {
        patchState(store, { boards });
      },
      async loadBoards(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const boards = await firstValueFrom(api.listBoards());
          patchState(store, { boards, loading: false });
        } catch (e) {
          patchState(store, {
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load boards',
          });
        }
      },
      async loadBoard(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const board = await firstValueFrom(api.getBoard(id));
          patchState(store, { activeBoard: normalizeBoard(board), loading: false, activeBoardMemberRole: null });

          const meId = store.user()?.id;
          if (!meId) {
            return;
          }
          if (meId === board.ownerId) {
            patchState(store, { activeBoardMemberRole: 'owner' });
            return;
          }
          // For non-owner users infer role from board members list.
          try {
            const members = await firstValueFrom(api.listBoardMembers(id));
            const mine = members.find((m) => m.id === meId);
            const mapped: BoardRole | null = mine ? (mine.role as BoardRole) : 'viewer';
            patchState(store, { activeBoardMemberRole: mapped });
          } catch {
            // Keep fallback (viewer) via computed; don't block board load.
            patchState(store, { activeBoardMemberRole: null });
          }
        } catch (e) {
          patchState(store, {
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to load board',
          });
        }
      },
      async refreshActiveBoard(): Promise<void> {
        const b = store.activeBoard();
        if (!b) {
          return;
        }
        patchState(store, { loading: true, error: null });
        try {
          const board = await firstValueFrom(api.getBoard(b.id));
          patchState(store, { activeBoard: normalizeBoard(board), loading: false, activeBoardMemberRole: store.activeBoardMemberRole() });

          const meId = store.user()?.id;
          if (!meId) {
            return;
          }
          if (meId === board.ownerId) {
            patchState(store, { activeBoardMemberRole: 'owner' });
            return;
          }
          try {
            const members = await firstValueFrom(api.listBoardMembers(board.id));
            const mine = members.find((m) => m.id === meId);
            const mapped: BoardRole | null = mine ? (mine.role as BoardRole) : 'viewer';
            patchState(store, { activeBoardMemberRole: mapped });
          } catch {
            patchState(store, { activeBoardMemberRole: store.activeBoardMemberRole() });
          }
        } catch (e) {
          patchState(store, {
            loading: false,
            error: e instanceof Error ? e.message : 'Failed to refresh board',
          });
        }
      },
      mergeBoardMetadata(board: BoardSummary): void {
        const cur = store.activeBoard();
        if (!cur || cur.id !== board.id) {
          return;
        }
        patchState(store, {
          activeBoard: { ...cur, ...board, columns: cur.columns },
        });
      },
      setBoardFullSnapshot(board: BoardDetails): void {
        patchState(store, { activeBoard: normalizeBoard(board) });
      },
      replaceColumns(boardId: string, columns: Column[]): void {
        const cur = store.activeBoard();
        if (!cur || cur.id !== boardId) {
          return;
        }
        const normalizedCols = sortColumns(
          columns.map((col) => ({
            ...col,
            cards: sortCards(col.cards),
          })),
        );
        patchState(store, {
          activeBoard: { ...cur, columns: normalizedCols },
        });
      },
      upsertCard(card: Card): void {
        const cur = store.activeBoard();
        if (!cur || cur.id !== card.boardId) {
          return;
        }
        if (!card.comments) {
          card = { ...card, comments: [] };
        }
        const next = cloneBoard(cur);
        for (const col of next.columns) {
          col.cards = col.cards.filter((c) => c.id !== card.id);
        }
        const col = next.columns.find((c) => c.id === card.columnId);
        if (col) {
          col.cards.push(card);
          col.cards = sortCards(col.cards);
        }
        patchState(store, { activeBoard: next });
      },
      applyOptimisticMove(cardId: string, targetColumnId: string, newOrder: number): void {
        const cur = store.activeBoard();
        if (!cur) {
          return;
        }
        const next = applyCardMove(cur, cardId, targetColumnId, newOrder);
        patchState(store, { activeBoard: next });
      },
      removeBoardFromList(boardId: string): void {
        patchState(store, {
          boards: store.boards().filter((b) => b.id !== boardId),
        });
        if (store.activeBoard()?.id === boardId) {
          patchState(store, { activeBoard: null });
        }
      },
    }),
  ),
);

export type BoardStoreType = InstanceType<typeof BoardStore>;
