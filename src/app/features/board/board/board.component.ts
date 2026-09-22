import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../../data/board-api.service';
import { BoardStore } from '../../../state/board.store';
import { TeamStore } from '../../../state/team.store';
import { SocketService } from '../../../realtime/socket.service';
import { BoardMemberDto, Card } from '../../../models/board.models';
import { TeamMember } from '../../../models/team.models';
import { ColumnComponent } from '../column/column.component';
import { AiAssistantComponent } from '../ai-assistant/ai-assistant.component';
import { FormsModule } from '@angular/forms';
import { CardModalComponent, CardModalSavePayload } from '../card-modal/card-modal.component';
import { CanViewDirective } from '../../../shared/directives/can-view.directive';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    DragDropModule,
    ColumnComponent,
    AiAssistantComponent,
    FormsModule,
    CardModalComponent,
    CanViewDirective,
    RouterLink,
  ],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent implements OnDestroy {
  @ViewChild(CardModalComponent) private cardModal?: CardModalComponent;

  readonly boardStore = inject(BoardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BoardApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);
  newColumnTitle = '';
  creatingColumn = false;
  creatingCardColumnId: string | null = null;
  skeletonCardId: string | null = null;
  skeletonColumnId: string | null = null;
  skeletonTitle = '';
  skeletonStartDate = '';
  skeletonEndDate = '';
  selectedCardId: string | null = null;
  togglingCardIds: ReadonlySet<string> = new Set();
  boardMembers: BoardMemberDto[] = [];
  private assigneeRequestId = 0;
  private titleRequestIds = new Map<string, number>();

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.boardMembers = [];
          this.socket.ensureConnected();
          this.socket.joinBoard(id);
          void this.loadBoardMembers(id);
          return from(this.boardStore.loadBoard(id)).pipe(
            tap(() => {}),
          );
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.boardMembers = [];
    this.boardStore.setActiveBoard(null);
    this.socket.resetActiveBoard();
  }

  async createColumn(): Promise<void> {
    if (!this.boardStore.canCreateColumn() || this.creatingColumn) {
      return;
    }
    const board = this.boardStore.activeBoard();
    const title = this.newColumnTitle.trim();
    if (!board || !title) {
      return;
    }
    this.creatingColumn = true;
    this.boardStore.setError(null);
    try {
      await firstValueFrom(
        this.api.createColumn({
          title,
          boardId: board.id,
        }),
      );
      this.newColumnTitle = '';
      await this.boardStore.refreshActiveBoard();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to create column');
    } finally {
      this.creatingColumn = false;
    }
  }

  async onAddCard(columnId: string): Promise<void> {
    if (!this.boardStore.canCreateCard() || this.creatingCardColumnId) {
      return;
    }
    const board = this.boardStore.activeBoard();
    if (!board) {
      return;
    }
    const previous = structuredClone(board);
    this.creatingCardColumnId = columnId;
    this.boardStore.setError(null);
    try {
      const created = await firstValueFrom(
        this.api.createCard({
          columnId,
          title: 'New task',
          description: '',
        }),
      );
      await firstValueFrom(this.api.moveCard(created.id, { targetColumnId: columnId, newOrder: 0 }));
      await this.boardStore.refreshActiveBoard();
      this.skeletonCardId = created.id;
      this.skeletonColumnId = columnId;
      const card = this.findCard(created.id);
      this.skeletonTitle = card?.title ?? 'New task';
      this.skeletonStartDate = this.toDateInputValue(card?.deadline?.startDate);
      this.skeletonEndDate = this.toDateInputValue(card?.deadline?.endDate);
    } catch (e) {
      this.boardStore.setActiveBoard(previous);
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to create card');
    } finally {
      this.creatingCardColumnId = null;
    }
  }

  async saveSkeleton(): Promise<void> {
    if (!this.skeletonCardId || !this.skeletonTitle.trim()) {
      return;
    }
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(this.skeletonCardId, {
          title: this.skeletonTitle.trim(),
          deadline:
            this.skeletonStartDate || this.skeletonEndDate
              ? {
                  startDate: this.skeletonStartDate || undefined,
                  endDate: this.skeletonEndDate || undefined,
                }
              : undefined,
        }),
      );
      this.boardStore.upsertCard(updated);
      this.clearSkeleton();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to save card');
    }
  }

  async cancelSkeleton(): Promise<void> {
    if (!this.skeletonCardId) {
      return;
    }
    const id = this.skeletonCardId;
    this.clearSkeleton();
    try {
      await firstValueFrom(this.api.deleteCard(id));
      await this.boardStore.refreshActiveBoard();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to cancel card draft');
    }
  }

  async onDrop(event: CdkDragDrop<Card[]>, targetColumnId: string): Promise<void> {
    if (!this.boardStore.canMoveCards()) {
      return;
    }
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    const card = event.previousContainer.data[event.previousIndex] as Card;
    const previous = structuredClone(this.boardStore.activeBoard()!);
    this.boardStore.applyOptimisticMove(card.id, targetColumnId, event.currentIndex);
    try {
      await firstValueFrom(
        this.api.moveCard(card.id, {
          targetColumnId,
          newOrder: event.currentIndex,
        }),
      );
    } catch {
      this.boardStore.setActiveBoard(previous);
    }
  }

  async toggleCardComplete(card: Card): Promise<void> {
    if (
      !this.boardStore.permissions().has('card:update') ||
      this.togglingCardIds.has(card.id)
    ) {
      return;
    }

    this.togglingCardIds = new Set(this.togglingCardIds).add(card.id);
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(card.id, { taskComplete: !card.taskComplete }),
      );
      this.boardStore.upsertCard(updated);
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update task status');
    } finally {
      const nextTogglingCardIds = new Set(this.togglingCardIds);
      nextTogglingCardIds.delete(card.id);
      this.togglingCardIds = nextTogglingCardIds;
    }
  }

  openCard(card: Card): void {
    if (this.skeletonCardId === card.id) {
      return;
    }
    this.selectedCardId = card.id;
  }

  closeCardModal(): void {
    this.selectedCardId = null;
  }

  async assignCard(cardId: string, userId: string): Promise<void> {
    const card = this.findCard(cardId);
    if (!card || !userId || card.assigneeId === userId) {
      return;
    }
    if (!this.boardStore.permissions().has('card:update')) {
      if (this.selectedCardId === card.id) {
        this.cardModal?.revertAssignee();
      }
      this.boardStore.setError('No permission to update cards');
      return;
    }

    const requestId = ++this.assigneeRequestId;
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(this.api.patchCard(card.id, { assigneeId: userId }));
      if (requestId !== this.assigneeRequestId) {
        return;
      }
      this.boardStore.upsertCard(updated);
    } catch (e) {
      if (requestId !== this.assigneeRequestId) {
        return;
      }
      if (this.selectedCardId === card.id) {
        this.cardModal?.revertAssignee();
      }
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update assignee');
    }
  }

  async renameCard(cardId: string, title: string): Promise<void> {
    const card = this.findCard(cardId);
    const nextTitle = title.trim();
    if (!card || !nextTitle || card.title === nextTitle) {
      return;
    }
    if (!this.boardStore.permissions().has('card:update')) {
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError('No permission to update cards');
      return;
    }

    const requestId = (this.titleRequestIds.get(cardId) ?? 0) + 1;
    this.titleRequestIds.set(cardId, requestId);
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(this.api.patchCard(cardId, { title: nextTitle }));
      if (this.titleRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard(updated);
    } catch (e) {
      if (this.titleRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to rename card');
    }
  }

  async saveCardModal(payload: CardModalSavePayload): Promise<void> {
    const card = this.activeModalCard();
    if (!card) {
      return;
    }
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(card.id, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          deadline: payload.deadline,
        }),
      );
      this.boardStore.upsertCard(updated);
      this.closeCardModal();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update card');
    }
  }

  activeModalCard(): Card | null {
    if (!this.selectedCardId) {
      return null;
    }
    return this.findCard(this.selectedCardId);
  }

  private async loadBoardMembers(boardId: string): Promise<void> {
    try {
      const members = await firstValueFrom(this.api.listBoardMembers(boardId));
      if (this.route.snapshot.paramMap.get('boardId') === boardId) {
        this.boardMembers = members.filter((member) => !!member.id);
      }
    } catch {
      if (this.route.snapshot.paramMap.get('boardId') === boardId) {
        this.boardMembers = [];
      }
    }
  }

  private clearSkeleton(): void {
    this.skeletonCardId = null;
    this.skeletonColumnId = null;
    this.skeletonTitle = '';
    this.skeletonStartDate = '';
    this.skeletonEndDate = '';
  }

  private findCard(cardId: string): Card | null {
    for (const col of this.boardStore.sortedColumns()) {
      const found = col.cards.find((c) => c.id === cardId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  private toDateInputValue(raw: string | Date | undefined): string {
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }
}
