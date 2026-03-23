import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { filter, map, switchMap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { SocketService } from '../../realtime/socket.service';
import { Card } from '../../models/board.models';
import { ColumnComponent } from './column.component';
import { AiAssistantComponent } from './ai-assistant.component';
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [DragDropModule, ColumnComponent, AiAssistantComponent],
  template: `
    <div class="relative flex h-[calc(100vh-8rem)] flex-col">
      @if (boardStore.loading() && !boardStore.activeBoard()) {
        <p class="text-slate-400">Loading board…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else if (boardStore.activeBoard()) {
        <div class="mb-4 flex items-center justify-between gap-4">
          <h1 class="text-xl font-semibold text-white">{{ boardStore.activeBoard()!.title }}</h1>
        </div>
        <div cdkDropListGroup class="flex flex-1 gap-4 overflow-x-auto pb-4">
          @for (col of boardStore.sortedColumns(); track col.id) {
            <app-column [column]="col" (dropped)="onDrop($event, col.id)" />
          }
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
}
