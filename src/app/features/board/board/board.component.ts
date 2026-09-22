import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../../data/board-api.service';
import { CardArchiveService } from '../../../data/card-archive.service';
import { BoardStore } from '../../../state/board.store';
import { TeamStore } from '../../../state/team.store';
import { SocketService } from '../../../realtime/socket.service';
import { BoardMemberDto, Card, CardActivityItem } from '../../../models/board.models';
import { TeamMember } from '../../../models/team.models';
import { ColumnComponent } from '../column/column.component';
import { AiAssistantComponent } from '../ai-assistant/ai-assistant.component';
import { FormsModule } from '@angular/forms';
import { CardModalComponent } from '../card-modal/card-modal.component';
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
  readonly archive = inject(CardArchiveService);
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
  skeletonAssigneeId = '';
  skeletonStartDate = '';
  skeletonEndDate = '';
  selectedCardId: string | null = null;
  cardActivity: CardActivityItem[] = [];
  private activityRequest = 0;
  togglingCardIds: ReadonlySet<string> = new Set();
  boardMembers: BoardMemberDto[] = [];
  private assigneeRequestId = 0;
  private titleRequestIds = new Map<string, number>();
  private descriptionRequestIds = new Map<string, number>();
  private priorityRequestIds = new Map<string, number>();
  private deadlineRequestIds = new Map<string, number>();
  private cardActionIds = new Set<string>();

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.boardMembers = [];
          this.archive.load(id);
          this.socket.ensureConnected();
          this.socket.joinBoard(id);
          void this.loadBoardMembers(id);
          return from(this.boardStore.loadBoard(id)).pipe(
            tap(() => this.pruneArchive()),
          );
        }),
      )
      .subscribe();

    this.socket.cardActivityRefresh$.pipe(takeUntilDestroyed()).subscribe((cardId) => {
      if (!this.selectedCardId) {
        return;
      }
      if (cardId && cardId !== this.selectedCardId) {
        return;
      }
      void this.loadCardActivity(this.selectedCardId);
    });
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
      this.skeletonAssigneeId = card?.assigneeId ?? '';
      this.skeletonStartDate = calendarDay(card?.deadline?.startDate);
      this.skeletonEndDate = calendarDay(card?.deadline?.endDate);
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
    const start = this.skeletonStartDate.trim();
    const end = this.skeletonEndDate.trim();
    if (start || end) {
      if (!isCalendarDay(start) || !isCalendarDay(end)) {
        this.boardStore.setError('Choose both start and end dates');
        return;
      }
      if (end < start) {
        this.boardStore.setError('endDate cannot be earlier than startDate');
        return;
      }
    }
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(this.skeletonCardId, {
          title: this.skeletonTitle.trim(),
          ...(this.skeletonAssigneeId ? { assigneeId: this.skeletonAssigneeId } : {}),
          ...(start && end ? { deadline: { startDate: start, endDate: end } } : {}),
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
    const columnId = this.skeletonColumnId;
    this.clearSkeleton();
    try {
      if (this.boardStore.permissions().has('card:purge')) {
        await firstValueFrom(this.api.purgeCard(id));
      } else {
        const archived = await firstValueFrom(this.api.deleteCard(id));
        const boardId = archived.boardId || this.boardStore.activeBoard()?.id || '';
        this.archive.remember({
          ...archived,
          boardId,
          columnId: archived.columnId || columnId || '',
          isDeleted: true,
        });
      }
      this.boardStore.removeCard(id);
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
    void this.loadCardActivity(card.id);
  }

  archivedCards(columnId: string): Card[] {
    const liveIds = new Set(
      (this.boardStore.activeBoard()?.columns ?? []).flatMap((column) => column.cards.map((card) => card.id)),
    );
    return this.archive.forColumn(columnId).filter((card) => !liveIds.has(card.id));
  }

  async archiveCard(card: Card): Promise<void> {
    if (!this.beginCardAction(card.id)) {
      return;
    }
    if (!this.boardStore.permissions().has('card:delete')) {
      this.boardStore.setError('No permission to archive cards');
      this.endCardAction(card.id);
      return;
    }
    this.boardStore.setError(null);
    try {
      const archived = await firstValueFrom(this.api.deleteCard(card.id));
      const boardId = archived.boardId || card.boardId || this.boardStore.activeBoard()?.id || '';
      this.archive.remember({ ...card, ...archived, boardId, isDeleted: true });
      this.boardStore.removeCard(card.id);
      if (this.selectedCardId === card.id) {
        this.closeCardModal();
      }
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to archive card');
    } finally {
      this.endCardAction(card.id);
    }
  }

  async purgeCard(card: Card): Promise<void> {
    if (!this.beginCardAction(card.id)) {
      return;
    }
    if (!this.boardStore.permissions().has('card:purge')) {
      this.boardStore.setError('No permission to delete cards');
      this.endCardAction(card.id);
      return;
    }
    this.boardStore.setError(null);
    try {
      await firstValueFrom(this.api.purgeCard(card.id));
      this.archive.forget(card.id);
      this.boardStore.removeCard(card.id);
      if (this.selectedCardId === card.id) {
        this.closeCardModal();
      }
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to delete card');
    } finally {
      this.endCardAction(card.id);
    }
  }

  async restoreCard(card: Card): Promise<void> {
    if (!this.beginCardAction(card.id)) {
      return;
    }
    if (!this.boardStore.permissions().has('card:delete')) {
      this.boardStore.setError('No permission to restore cards');
      this.endCardAction(card.id);
      return;
    }
    this.boardStore.setError(null);
    try {
      const restored = await firstValueFrom(this.api.restoreCard(card.id));
      this.archive.forget(card.id);
      this.boardStore.upsertCard({ ...restored, isDeleted: false });
      this.closeCardModal();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to restore card');
    } finally {
      this.endCardAction(card.id);
    }
  }

  closeCardModal(): void {
    this.selectedCardId = null;
    this.cardActivity = [];
    this.activityRequest++;
  }

  async assignCard(cardId: string, userId: string | null): Promise<void> {
    if (userId === '') {
      return;
    }
    const card = this.findCard(cardId);
    const current = card?.assigneeId ?? null;
    if (!card || userId === current) {
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
      void this.loadCardActivity(card.id);
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

  async updateCardDeadline(
    cardId: string,
    deadline: { startDate: string; endDate: string } | null,
  ): Promise<void> {
    const card = this.findCard(cardId);
    if (!card) {
      return;
    }
    if (deadline && deadline.endDate < deadline.startDate) {
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError('endDate cannot be earlier than startDate');
      return;
    }
    const currentStart = calendarDay(card.deadline?.startDate);
    const currentEnd = calendarDay(card.deadline?.endDate);
    const unchanged = deadline
      ? deadline.startDate === currentStart && deadline.endDate === currentEnd
      : !currentStart && !currentEnd;
    if (unchanged) {
      return;
    }
    if (!this.boardStore.permissions().has('card:update')) {
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError('No permission to update cards');
      return;
    }

    const requestId = (this.deadlineRequestIds.get(cardId) ?? 0) + 1;
    this.deadlineRequestIds.set(cardId, requestId);
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(cardId, {
          deadline: deadline ? { startDate: deadline.startDate, endDate: deadline.endDate } : null,
        }),
      );
      if (this.deadlineRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard(updated);
      void this.loadCardActivity(cardId);
    } catch (e) {
      if (this.deadlineRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update deadline');
    }
  }

  async updateCardDescription(cardId: string, description: string): Promise<void> {
    const card = this.findCard(cardId);
    if (!card || card.description === description) {
      return;
    }
    if (!this.boardStore.permissions().has('card:update')) {
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError('No permission to update cards');
      return;
    }

    const requestId = (this.descriptionRequestIds.get(cardId) ?? 0) + 1;
    this.descriptionRequestIds.set(cardId, requestId);
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(this.api.patchCard(cardId, { description }));
      if (this.descriptionRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard(updated);
      void this.loadCardActivity(cardId);
    } catch (e) {
      if (this.descriptionRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update description');
    }
  }

  async updateCardPriority(
    cardId: string,
    priority: 'low' | 'medium' | 'high' | null,
  ): Promise<void> {
    const card = this.findCard(cardId);
    if (!card || (card.priority ?? null) === priority) {
      return;
    }
    if (!this.boardStore.permissions().has('card:update')) {
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError('No permission to update cards');
      return;
    }

    const requestId = (this.priorityRequestIds.get(cardId) ?? 0) + 1;
    this.priorityRequestIds.set(cardId, requestId);
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(this.api.patchCard(cardId, { priority }));
      if (this.priorityRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard(updated);
    } catch (e) {
      if (this.priorityRequestIds.get(cardId) !== requestId) {
        return;
      }
      this.boardStore.upsertCard({ ...card });
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update priority');
    }
  }

  async addComment(cardId: string, text: string, parentCommentId?: string): Promise<void> {
    const next = text.trim();
    const card = this.findCard(cardId) ?? this.archive.find(cardId);
    if (!card || !next) {
      return;
    }
    if (!this.boardStore.permissions().has('comment:create')) {
      this.boardStore.setError('No permission to comment');
      return;
    }
    this.boardStore.setError(null);
    try {
      const body = parentCommentId ? { text: next, parentCommentId } : { text: next };
      const updated = await firstValueFrom(this.api.addComment(cardId, body));
      this.replaceVisibleCard(updated);
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to add comment');
    }
  }

  async updateComment(cardId: string, commentId: string, text: string): Promise<void> {
    const next = text.trim();
    const card = this.findCard(cardId) ?? this.archive.find(cardId);
    const comment = card?.comments?.find((item) => item._id === commentId);
    if (!card || !comment || !next || comment.text === next) {
      return;
    }
    const mine = comment.authorId === this.boardStore.user()?.id;
    const allowed = mine
      ? this.boardStore.permissions().has('comment:update:own')
      : this.boardStore.permissions().has('comment:update:any');
    if (!allowed) {
      this.replaceVisibleCard({ ...card, comments: [...(card.comments ?? [])] });
      this.boardStore.setError('No permission to edit this comment');
      return;
    }
    this.boardStore.setError(null);
    try {
      const updated = await firstValueFrom(this.api.updateComment(cardId, commentId, { text: next }));
      this.replaceVisibleCard(updated);
    } catch (e) {
      this.replaceVisibleCard({ ...card, comments: [...(card.comments ?? [])] });
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update comment');
    }
  }

  private replaceVisibleCard(card: Card): void {
    if (this.findCard(card.id)) {
      this.boardStore.upsertCard(card);
      return;
    }
    if (card.isDeleted || this.archive.find(card.id)) {
      this.archive.remember({ ...card, isDeleted: true });
    }
  }

  activeModalCard(): Card | null {
    if (!this.selectedCardId) {
      return null;
    }
    return this.findCard(this.selectedCardId) ?? this.archive.find(this.selectedCardId);
  }

  private async loadCardActivity(cardId: string): Promise<void> {
    const request = ++this.activityRequest;
    try {
      const response = await firstValueFrom(this.api.getCardActivity(cardId));
      if (request !== this.activityRequest || this.selectedCardId !== cardId) {
        return;
      }
      this.cardActivity = response.items ?? [];
    } catch (e) {
      if (request !== this.activityRequest || this.selectedCardId !== cardId) {
        return;
      }
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to load activity');
    }
  }

  private pruneArchive(): void {
    const board = this.boardStore.activeBoard();
    if (!board) {
      return;
    }
    const liveIds = new Set(board.columns.flatMap((column) => column.cards.map((card) => card.id)));
    this.archive.forgetPresent(liveIds);
  }

  private beginCardAction(cardId: string): boolean {
    if (this.cardActionIds.has(cardId)) {
      return false;
    }
    this.cardActionIds.add(cardId);
    return true;
  }

  private endCardAction(cardId: string): void {
    this.cardActionIds.delete(cardId);
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
    this.skeletonAssigneeId = '';
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

}

function calendarDay(raw: string | Date | undefined): string {
  if (!raw) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  }
  const month = `${raw.getMonth() + 1}`.padStart(2, '0');
  const day = `${raw.getDate()}`.padStart(2, '0');
  return `${raw.getFullYear()}-${month}-${day}`;
}

function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
