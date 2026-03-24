import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card, CardDeadline } from '../../models/board.models';

export interface CardModalSavePayload {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: CardDeadline;
}

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (card) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" (click)="close.emit()">
        <div
          class="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-white">Card details</h2>
            <button type="button" class="text-sm text-slate-400 hover:text-white" (click)="close.emit()">Close</button>
          </div>
          <div class="grid gap-4">
            <label class="grid gap-1 text-sm text-slate-300">
              Title
              <input
                class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                [(ngModel)]="draftTitle"
              />
            </label>
            <label class="grid gap-1 text-sm text-slate-300">
              Description
              <textarea
                class="min-h-24 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                [(ngModel)]="draftDescription"
              ></textarea>
            </label>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label class="grid gap-1 text-sm text-slate-300">
                Priority
                <select
                  class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  [(ngModel)]="draftPriority"
                >
                  <option [ngValue]="undefined">No priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label class="grid gap-1 text-sm text-slate-300">
                Start date
                <input
                  type="date"
                  class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  [(ngModel)]="draftDeadlineStartDate"
                />
              </label>
              <label class="grid gap-1 text-sm text-slate-300">
                End date
                <input
                  type="date"
                  class="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  [(ngModel)]="draftDeadlineEndDate"
                />
              </label>
            </div>
          </div>
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
              (click)="close.emit()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600"
              [disabled]="!draftTitle.trim()"
              (click)="submit()"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CardModalComponent {
  @Input()
  set card(value: Card | null) {
    this._card = value;
    this.draftTitle = value?.title ?? '';
    this.draftDescription = value?.description ?? '';
    this.draftPriority = value?.priority;
    this.draftDeadlineStartDate = this.toDateInputValue(value?.deadline?.startDate);
    this.draftDeadlineEndDate = this.toDateInputValue(value?.deadline?.endDate);
  }

  get card(): Card | null {
    return this._card;
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CardModalSavePayload>();

  private _card: Card | null = null;

  draftTitle = '';
  draftDescription = '';
  draftPriority: 'low' | 'medium' | 'high' | undefined = undefined;
  draftDeadlineStartDate = '';
  draftDeadlineEndDate = '';

  submit(): void {
    if (!this.draftTitle.trim()) {
      return;
    }
    this.save.emit({
      title: this.draftTitle.trim(),
      description: this.draftDescription.trim(),
      priority: this.draftPriority,
      deadline:
        this.draftDeadlineStartDate || this.draftDeadlineEndDate
          ? {
              startDate: this.draftDeadlineStartDate || undefined,
              endDate: this.draftDeadlineEndDate || undefined,
            }
          : undefined,
    });
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
