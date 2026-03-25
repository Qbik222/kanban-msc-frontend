import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { TeamStore } from '../../state/team.store';
import { SocketService } from '../../realtime/socket.service';
import { Card } from '../../models/board.models';
import { TeamMember } from '../../models/team.models';
import { ColumnComponent } from './column.component';
import { AiAssistantComponent } from './ai-assistant';
import { FormsModule } from '@angular/forms';
import { CardModalComponent, CardModalSavePayload } from './card-modal.component';
import { CanViewDirective } from '../../shared/directives/can-view.directive';
import { ToastService } from '../../core/toast/toast.service';

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
  template: `
    <div class="relative flex h-[calc(100vh-8rem)] flex-col">
      @if (boardStore.loading() && !boardStore.activeBoard()) {
        <p class="text-slate-400">Loading board…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else if (boardStore.activeBoard()) {
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-xl font-semibold text-white">{{ boardStore.activeBoard()!.title }}</h1>
            <p class="mt-0.5 text-xs text-slate-500">team: {{ boardStore.activeBoard()!.teamId }}</p>
          </div>
          <div class="flex items-center gap-2">
            <a
              class="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
              [routerLink]="['/boards', boardStore.activeBoard()!.id, 'settings']"
            >
              Settings
            </a>
            @if (boardStore.canCreateColumn()) {
              <input
                type="text"
                class="w-56 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                placeholder="Add column title"
                [(ngModel)]="newColumnTitle"
                [disabled]="creatingColumn"
                (keydown.enter)="createColumn()"
              />
              <button
                type="button"
                class="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="creatingColumn || !newColumnTitle.trim()"
                (click)="createColumn()"
              >
                {{ creatingColumn ? 'Adding…' : 'Add column' }}
              </button>
            }
          </div>
        </div>
        <div cdkDropListGroup class="flex min-w-full flex-1 gap-4 overflow-x-auto pb-4">
          @for (col of boardStore.sortedColumns(); track col.id) {
            <app-column
              class="shrink-0"
              [column]="col"
              [canCreateCard]="boardStore.canCreateCard()"
              [canMoveCards]="boardStore.canMoveCards()"
              [creatingCard]="creatingCardColumnId === col.id"
              [showSkeleton]="skeletonColumnId === col.id && !!skeletonCardId"
              [skeletonCardId]="skeletonCardId"
              [skeletonTitle]="skeletonTitle"
              [skeletonStartDate]="skeletonStartDate"
              [skeletonEndDate]="skeletonEndDate"
              (addCard)="onAddCard(col.id)"
              (openCard)="openCard($event)"
              (skeletonTitleChange)="skeletonTitle = $event"
              (skeletonStartDateChange)="skeletonStartDate = $event"
              (skeletonEndDateChange)="skeletonEndDate = $event"
              (saveSkeleton)="saveSkeleton()"
              (cancelSkeleton)="cancelSkeleton()"
              (dropped)="onDrop($event, col.id)"
            />
          }
        </div>
      }
      <app-ai-assistant />
      <app-card-modal [card]="activeModalCard()" (close)="closeCardModal()" (save)="saveCardModal($event)" />
    </div>
  `,
})
export class BoardComponent implements OnDestroy {
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

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.socket.ensureConnected();
          this.socket.joinBoard(id);
          return from(this.boardStore.loadBoard(id)).pipe(
            tap(() => {}),
          );
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.boardStore.setActiveBoard(null);
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

  openCard(card: Card): void {
    if (this.skeletonCardId === card.id) {
      return;
    }
    this.selectedCardId = card.id;
  }

  closeCardModal(): void {
    this.selectedCardId = null;
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
