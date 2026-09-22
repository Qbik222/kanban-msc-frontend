import { Injectable, signal } from '@angular/core';
import { Card } from '../models/board.models';

@Injectable({ providedIn: 'root' })
export class CardArchiveService {
  private readonly cardsSignal = signal<Card[]>([]);
  private boardId: string | null = null;

  cards(): Card[] {
    return this.cardsSignal();
  }

  load(boardId: string): void {
    this.boardId = boardId;
    this.cardsSignal.set(this.read(boardId));
  }

  forColumn(columnId: string): Card[] {
    return this.cardsSignal().filter((card) => card.columnId === columnId);
  }

  find(cardId: string): Card | null {
    return this.cardsSignal().find((card) => card.id === cardId) ?? null;
  }

  remember(card: Card): void {
    if (!this.boardId || card.boardId !== this.boardId) {
      return;
    }
    const next = this.cardsSignal().filter((item) => item.id !== card.id);
    next.unshift({ ...card, isDeleted: true });
    this.cardsSignal.set(next);
    this.persist();
  }

  forget(cardId: string): void {
    this.cardsSignal.set(this.cardsSignal().filter((card) => card.id !== cardId));
    this.persist();
  }

  forgetPresent(cardIds: ReadonlySet<string>): void {
    const next = this.cardsSignal().filter((card) => !cardIds.has(card.id));
    if (next.length === this.cardsSignal().length) {
      return;
    }
    this.cardsSignal.set(next);
    this.persist();
  }

  private persist(): void {
    if (!this.boardId) {
      return;
    }
    try {
      localStorage.setItem(this.storageKey(this.boardId), JSON.stringify(this.cardsSignal()));
    } catch {
      // Private mode or a full quota should not block archiving in the current view.
    }
  }

  private read(boardId: string): Card[] {
    try {
      const raw = localStorage.getItem(this.storageKey(boardId));
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as Card[];
      return Array.isArray(parsed) ? parsed.filter((card) => !!card?.id) : [];
    } catch {
      return [];
    }
  }

  private storageKey(boardId: string): string {
    return `kanban.archivedCards.${boardId}`;
  }
}
