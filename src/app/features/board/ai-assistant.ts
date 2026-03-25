import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiBridgeService } from '../../ai/ai-bridge.service';
import { BoardStore } from '../../state/board.store';

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div
      class="fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between border-b border-slate-800 px-3 py-2 text-left text-sm font-medium text-white"
        (click)="open.set(!open())"
      >
        AI context
        <span class="text-slate-500">{{ open() ? '−' : '+' }}</span>
      </button>
      @if (open()) {
        <div class="max-h-64 overflow-auto p-3 text-xs text-slate-300">
          <pre class="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">{{
            bridge.getBoardContext()
          }}</pre>
        </div>
        <div class="border-t border-slate-800 p-2">
          <p class="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Try action (JSON payload)</p>
          <textarea
            class="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200"
            rows="3"
            [(ngModel)]="payloadJson"
            placeholder='{"cardId":"...","targetColumnId":"...","newOrder":0}'
          ></textarea>
          <div class="flex gap-2">
            <select
              class="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
              [(ngModel)]="action"
            >
              <option value="moveCard">moveCard</option>
              <option value="updateCard">updateCard</option>
              <option value="createCard">createCard</option>
              <option value="deleteCard">deleteCard</option>
            </select>
            <button
              type="button"
              class="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
              [disabled]="running() || !boardStore.canMoveCards()"
              (click)="run()"
            >
              {{ running() ? '…' : 'Run' }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class AiAssistantComponent {
  readonly bridge = inject(AiBridgeService);
  readonly boardStore = inject(BoardStore);

  open = signal(false);
  action = 'moveCard';
  payloadJson = '';
  running = signal(false);

  async run(): Promise<void> {
    let payload: unknown;
    try {
      payload = this.payloadJson ? JSON.parse(this.payloadJson) : {};
    } catch {
      return;
    }
    this.running.set(true);
    try {
      await this.bridge.executeAiAction(this.action, payload);
    } finally {
      this.running.set(false);
    }
  }
}
