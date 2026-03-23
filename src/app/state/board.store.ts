import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { BoardApiService } from '../data/board-api.service';
import { BoardDetails, BoardSummary, Card, Column, UserProfile } from '../models/board.models';
import { BoardRole, ROLE_PERMISSIONS, roleHasAnyPermission } from './permissions';

function sortColumns(cols: Column[]): Column[] {
  return [...cols].sort((a, b) => a.order - b.order);
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.order - b.order);
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
}

const initialState: BoardState = {
  boards: [],
  activeBoard: null,
  user: null,
  loading: false,
  error: null,
};

export const BoardStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const isOwner = computed(() => {
      const u = store.user();
      const b = store.activeBoard();
      return !!(u && b && u.id === b.ownerId);
    });
    const effectiveRole = computed((): BoardRole => (isOwner() ? 'owner' : 'viewer'));
    const permissions = computed(() => {
      const role = effectiveRole();
      return new Set(ROLE_PERMISSIONS[role]);
    });
    const canEdit = computed(() =>
      roleHasAnyPermission(effectiveRole(), [
        'card:create',
        'card:update',
        'card:move',
        'column:create',
        'board:update',
      ]),
    );
    const canComment = computed(() => roleHasAnyPermission(effectiveRole(), ['comment:create']));
    const sortedColumns = computed(() => {
      const b = store.activeBoard();
      if (!b) {
        return [];
      }
      return sortColumns(b.columns).map((c) => ({
        ...c,
        cards: sortCards(c.cards),
      }));
    });
    return {
      isOwner,
      effectiveRole,
      permissions,
      canEdit,
      canComment,
      sortedColumns,
    };
  }),
  withMethods(
    (
      store,
      api = inject(BoardApiService),
    ) => ({
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
        patchState(store, { activeBoard: board });
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
          patchState(store, { activeBoard: board, loading: false });
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
          patchState(store, { activeBoard: board, loading: false });
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
        patchState(store, { activeBoard: board });
      },
      replaceColumns(boardId: string, columns: Column[]): void {
        const cur = store.activeBoard();
        if (!cur || cur.id !== boardId) {
          return;
        }
        patchState(store, {
          activeBoard: { ...cur, columns },
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
