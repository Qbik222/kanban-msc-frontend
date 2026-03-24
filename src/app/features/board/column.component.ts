import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Column, Card } from '../../models/board.models';
import { CardComponent } from './card.component';

@Component({
  selector: 'app-column',
  standalone: true,
  imports: [DragDropModule, CardComponent, FormsModule],
  template: `
    <div
      class="group flex h-full min-h-[min(70vh,640px)] w-72 shrink-0 flex-col rounded-lg border border-slate-800 bg-slate-900/60"
    >
      <div class="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h2 class="font-medium text-slate-100">{{ column.title }}</h2>
        <button
          type="button"
          class="rounded px-1.5 py-0.5 text-sm text-slate-400 opacity-0 transition hover:bg-slate-800 hover:text-white group-hover:opacity-100"
          [disabled]="!canEdit || creatingCard"
          (click)="addCard.emit()"
        >
          +
        </button>
      </div>
      <div
        cdkDropList
        [id]="column.id"
        [cdkDropListData]="column.cards"
        class="flex flex-1 flex-col gap-2 overflow-y-auto p-2"
        (cdkDropListDropped)="dropped.emit($event)"
      >
        @if (showSkeleton) {
          <div class="rounded-md border border-emerald-700/70 bg-slate-950/90 p-3">
            <input
              class="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
              placeholder="Task title"
              [ngModel]="skeletonTitle"
              (ngModelChange)="skeletonTitleChange.emit($event)"
            />
            <input
              type="date"
              class="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              [ngModel]="skeletonStartDate"
              (ngModelChange)="skeletonStartDateChange.emit($event)"
            />
            <input
              type="date"
              class="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              [ngModel]="skeletonEndDate"
              (ngModelChange)="skeletonEndDateChange.emit($event)"
            />
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white"
                (click)="cancelSkeleton.emit()"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
                [disabled]="!skeletonTitle.trim()"
                (click)="saveSkeleton.emit()"
              >
                Save
              </button>
            </div>
          </div>
        }
        @for (c of column.cards; track c.id) {
          @if (!(showSkeleton && c.id === skeletonCardId)) {
            <div cdkDrag [cdkDragData]="c" class="cursor-grab active:cursor-grabbing">
              <app-card [card]="c" (clicked)="openCard.emit(c)" />
            </div>
          }
        }
        <button
          type="button"
          class="mt-1 rounded border border-dashed border-slate-700 px-2 py-2 text-left text-xs text-slate-400 opacity-0 transition hover:border-slate-500 hover:text-slate-200 group-hover:opacity-100"
          [disabled]="!canEdit || creatingCard"
          (click)="addCard.emit()"
        >
          + Add card
        </button>
      </div>
    </div>
  `,
})
export class ColumnComponent {
  @Input({ required: true }) column!: Column;
  @Input() canEdit = false;
  @Input() creatingCard = false;
  @Input() showSkeleton = false;
  @Input() skeletonCardId: string | null = null;
  @Input() skeletonTitle = '';
  @Input() skeletonStartDate = '';
  @Input() skeletonEndDate = '';

  @Output() dropped = new EventEmitter<CdkDragDrop<Card[]>>();
  @Output() addCard = new EventEmitter<void>();
  @Output() openCard = new EventEmitter<Card>();
  @Output() skeletonTitleChange = new EventEmitter<string>();
  @Output() skeletonStartDateChange = new EventEmitter<string>();
  @Output() skeletonEndDateChange = new EventEmitter<string>();
  @Output() saveSkeleton = new EventEmitter<void>();
  @Output() cancelSkeleton = new EventEmitter<void>();
}
