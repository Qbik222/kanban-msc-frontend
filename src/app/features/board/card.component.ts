import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Card } from '../../models/board.models';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [DatePipe],
  template: `
    <article
      class="rounded-md border border-slate-700 bg-slate-950/80 p-3 shadow-sm transition hover:border-slate-500"
      (click)="clicked.emit()"
    >
      <h3 class="font-medium text-slate-100">{{ card.title }}</h3>
      @if (card.description) {
        <p class="mt-1 line-clamp-3 text-xs text-slate-400">{{ card.description }}</p>
      }
      <div class="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        @if (card.priority) {
          <span
            class="rounded px-1.5 py-0.5 uppercase tracking-wide"
            [class.bg-amber-900]="card.priority === 'high'"
            [class.bg-slate-800]="card.priority !== 'high'"
            >{{ card.priority }}</span>
        }
        @if (card.projectIds?.length) {
          <span>{{ card.projectIds.length }} projects</span>
        }
        @if (card.deadline?.startDate && card.deadline?.endDate) {
          <span>{{ card.deadline?.startDate | date: 'MMM d' }} - {{ card.deadline?.endDate | date: 'MMM d' }}</span>
        } @else if (card.deadline?.startDate) {
          <span>Start {{ card.deadline?.startDate | date: 'MMM d' }}</span>
        } @else if (card.deadline?.endDate) {
          <span>Due {{ card.deadline?.endDate | date: 'MMM d' }}</span>
        }
        <span>{{ card.comments?.length ?? 0 }} comments</span>
      </div>
    </article>
  `,
})
export class CardComponent {
  @Input({ required: true }) card!: Card;
  @Output() clicked = new EventEmitter<void>();
}
