import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Column, Card } from '../../models/board.models';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-column',
  standalone: true,
  imports: [DragDropModule, CardComponent],
  template: `
    <div
      class="flex h-full min-h-[min(70vh,640px)] w-72 shrink-0 flex-col rounded-lg border border-slate-800 bg-slate-900/60"
    >
      <div class="border-b border-slate-800 px-3 py-2">
        <h2 class="font-medium text-slate-100">{{ column.title }}</h2>
      </div>
      <div
        cdkDropList
        [id]="column.id"
        [cdkDropListData]="column.cards"
        class="flex flex-1 flex-col gap-2 overflow-y-auto p-2"
        (cdkDropListDropped)="dropped.emit($event)"
      >
        @for (c of column.cards; track c.id) {
          <div cdkDrag [cdkDragData]="c" class="cursor-grab active:cursor-grabbing">
            <app-card [card]="c" />
          </div>
        }
      </div>
    </div>
  `,
})
export class ColumnComponent {
  @Input({ required: true }) column!: Column;
  @Output() dropped = new EventEmitter<CdkDragDrop<Card[]>>();
}
