import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { filter, map, switchMap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { SocketService } from '../../realtime/socket.service';
import { Card, Column } from '../../models/board.models';
import { ColumnComponent } from './column.component';
import { AiAssistantComponent } from './ai-assistant';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [DragDropModule, ColumnComponent, AiAssistantComponent, FormsModule],
  template: `
    <div class="relative flex h-[calc(100vh-8rem)] flex-col">
      @if (boardStore.loading() && !boardStore.activeBoard()) {
        <p class="text-slate-400">Loading board…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else if (boardStore.activeBoard()) {
        <div class="mb-4 flex items-center justify-between gap-4">
          <h1 class="text-xl font-semibold text-white">{{ boardStore.activeBoard()!.title }}</h1>
          @if (boardStore.canEdit()) {
            <div class="flex items-center gap-2">
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
            </div>
          }
        </div>
        <div cdkDropListGroup class="flex flex-1 overflow-x-auto pb-4">
          <div
            cdkDropList
            cdkDropListOrientation="horizontal"
            [cdkDropListData]="boardStore.sortedColumns()"
            class="flex min-w-full gap-4"
            (cdkDropListDropped)="onColumnDrop($event)"
          >
            @for (col of boardStore.sortedColumns(); track col.id) {
              <div cdkDrag [cdkDragDisabled]="!boardStore.canEdit()" class="shrink-0">
                <app-column [column]="col" (dropped)="onDrop($event, col.id)" />
              </div>
            }
          </div>
        </div>
      }
      <app-ai-assistant />
    </div>
  `,
})
export class BoardComponent implements OnDestroy {
  readonly boardStore = inject(BoardStore);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BoardApiService);
  private readonly socket = inject(SocketService);
  newColumnTitle = '';
  creatingColumn = false;

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.socket.ensureConnected();
          this.socket.joinBoard(id);
          return from(this.boardStore.loadBoard(id));
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.boardStore.setActiveBoard(null);
  }

  async createColumn(): Promise<void> {
    if (!this.boardStore.canEdit() || this.creatingColumn) {
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

  async onDrop(event: CdkDragDrop<Card[]>, targetColumnId: string): Promise<void> {
    if (!this.boardStore.canEdit()) {
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

  async onColumnDrop(event: CdkDragDrop<Column[]>): Promise<void> {
    if (!this.boardStore.canEdit()) {
      return;
    }
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const board = this.boardStore.activeBoard();
    if (!board) {
      return;
    }
    const previous = structuredClone(board);
    const reordered = [...this.boardStore.sortedColumns()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    const normalized = reordered.map((col, order) => ({ ...col, order }));
    this.boardStore.setActiveBoard({ ...board, columns: normalized });
    try {
      await firstValueFrom(
        this.api.reorderColumns(
          normalized.map((col) => ({
            id: col.id,
            order: col.order,
          })),
        ),
      );
      await this.boardStore.refreshActiveBoard();
    } catch {
      this.boardStore.setActiveBoard(previous);
    }
  }
}
