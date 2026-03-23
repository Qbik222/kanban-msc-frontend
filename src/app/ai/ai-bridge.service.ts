import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BoardApiService } from '../data/board-api.service';
import { BoardStore } from '../state/board.store';

export interface BoardContextPayload {
  boardId: string;
  title: string;
  columns: {
    id: string;
    title: string;
    order: number;
    cards: {
      id: string;
      title: string;
      description: string;
      order: number;
      priority?: string;
      commentCount: number;
      projectIds: string[];
    }[];
  }[];
}

@Injectable({ providedIn: 'root' })
export class AiBridgeService {
  private readonly store = inject(BoardStore);
  private readonly api = inject(BoardApiService);

  getBoardContext(): string {
    const board = this.store.activeBoard();
    if (!board) {
      return JSON.stringify({ board: null });
    }
    const payload: BoardContextPayload = {
      boardId: board.id,
      title: board.title,
      columns: this.store.sortedColumns().map((col) => ({
        id: col.id,
        title: col.title,
        order: col.order,
        cards: col.cards.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          order: c.order,
          priority: c.priority,
          commentCount: c.comments?.length ?? 0,
          projectIds: c.projectIds ?? [],
        })),
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  async executeAiAction(action: string, payload: unknown): Promise<void> {
    switch (action) {
      case 'moveCard': {
        const p = payload as { cardId: string; targetColumnId: string; newOrder: number };
        await firstValueFrom(
          this.api.moveCard(p.cardId, { targetColumnId: p.targetColumnId, newOrder: p.newOrder }),
        );
        await this.store.refreshActiveBoard();
        return;
      }
      case 'updateCard': {
        const p = payload as { cardId: string; patch: Record<string, unknown> };
        await firstValueFrom(this.api.patchCard(p.cardId, p.patch));
        await this.store.refreshActiveBoard();
        return;
      }
      case 'createCard': {
        const p = payload as {
          columnId: string;
          title: string;
          description: string;
          priority?: 'low' | 'medium' | 'high';
        };
        await firstValueFrom(
          this.api.createCard({
            columnId: p.columnId,
            title: p.title,
            description: p.description,
            priority: p.priority,
          }),
        );
        await this.store.refreshActiveBoard();
        return;
      }
      case 'deleteCard': {
        const p = payload as { cardId: string };
        await firstValueFrom(this.api.deleteCard(p.cardId));
        await this.store.refreshActiveBoard();
        return;
      }
      default:
        throw new Error(`Unknown AI action: ${action}`);
    }
  }
}
