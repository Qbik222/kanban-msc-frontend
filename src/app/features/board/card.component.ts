import { Component, Input } from '@angular/core';
import { Card } from '../../models/board.models';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <article class="rounded-md border border-slate-700 bg-slate-950/80 p-3 shadow-sm">
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
        <span>{{ card.comments?.length ?? 0 }} comments</span>
      </div>
    </article>
  `,
})
export class CardComponent {
  @Input({ required: true }) card!: Card;
}
