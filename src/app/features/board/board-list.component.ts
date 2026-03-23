import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { CanViewDirective } from '../../shared/directives/can-view.directive';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [RouterLink, FormsModule, CanViewDirective],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 class="text-2xl font-semibold text-white">Your boards</h1>
        <div *canView="['board:create']" class="flex gap-2">
          <input
            class="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="New board title"
            [(ngModel)]="newTitle"
            name="title"
          />
          <button
            type="button"
            class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            [disabled]="creating || !newTitle.trim()"
            (click)="createBoard()"
          >
            {{ creating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
      @if (boardStore.loading()) {
        <p class="text-slate-400">Loading boards…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (b of boardStore.boards(); track b.id) {
            <a
              [routerLink]="['/boards', b.id]"
              class="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow hover:border-emerald-700"
            >
              <h2 class="font-medium text-white">{{ b.title }}</h2>
              <p class="mt-1 text-xs text-slate-500">Board ID: {{ b.id }}</p>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class BoardListComponent implements OnInit {
  readonly boardStore = inject(BoardStore);
  private readonly api = inject(BoardApiService);

  newTitle = '';
  creating = false;

  ngOnInit(): void {
    void this.boardStore.loadBoards();
  }

  async createBoard(): Promise<void> {
    const title = this.newTitle.trim();
    if (!title) {
      return;
    }
    this.creating = true;
    try {
      await firstValueFrom(this.api.createBoard({ title, projectIds: [] }));
      this.newTitle = '';
      await this.boardStore.loadBoards();
    } finally {
      this.creating = false;
    }
  }
}
