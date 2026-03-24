import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { TeamStore } from '../../state/team.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-6xl">
      <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 class="text-2xl font-semibold text-white">Дошки</h1>
        @if (teamStore.hasAdminTeam()) {
          <div class="flex flex-wrap items-end gap-2">
            <label class="flex flex-col gap-1 text-xs text-slate-400">
              Команда
              <select
                class="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                [(ngModel)]="createTeamId"
                name="createTeam"
              >
                @for (t of teamStore.adminTeams(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </label>
            <input
              class="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              placeholder="Назва дошки"
              [(ngModel)]="newTitle"
              name="title"
            />
            <button
              type="button"
              class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              [disabled]="creating || !newTitle.trim() || !createTeamId"
              (click)="createBoard()"
            >
              {{ creating ? 'Створення…' : 'Створити дошку' }}
            </button>
          </div>
        }
      </div>

      <div class="mb-6 flex flex-wrap items-center gap-3">
        <label class="text-sm text-slate-400">Фільтр за командою:</label>
        <select
          class="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white"
          [ngModel]="teamStore.selectedTeamFilterId() ?? ''"
          (ngModelChange)="teamStore.setSelectedTeamFilterId($event || null)"
          name="filterTeam"
        >
          <option value="">Усі команди</option>
          @for (t of teamStore.teams(); track t.id) {
            <option [value]="t.id">{{ t.name }}</option>
          }
        </select>
      </div>

      @if (boardStore.loading() && !boardStore.boards().length) {
        <p class="text-slate-400">Завантаження дошок…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else if (!boardStore.boards().length) {
        <p class="text-slate-400">Поки немає дошок.</p>
      } @else {
        @for (g of groupedBoards(); track g.teamId) {
          <section class="mb-8">
            <h2 class="mb-3 text-lg font-medium text-slate-200">{{ g.teamName }}</h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              @for (b of g.boards; track b.id) {
                <a
                  [routerLink]="['/boards', b.id]"
                  class="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow hover:border-emerald-700"
                >
                  <h3 class="font-medium text-white">{{ b.title }}</h3>
                  <p class="mt-1 text-xs text-slate-500">team: {{ b.teamId }}</p>
                </a>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class BoardListComponent implements OnInit {
  readonly boardStore = inject(BoardStore);
  readonly teamStore = inject(TeamStore);
  private readonly api = inject(BoardApiService);

  readonly groupedBoards = computed(() => {
    const filter = this.teamStore.selectedTeamFilterId();
    let boards = this.boardStore.boards();
    if (filter) {
      boards = boards.filter((b) => b.teamId === filter);
    }
    const byTeam = new Map<string, typeof boards>();
    for (const b of boards) {
      const list = byTeam.get(b.teamId) ?? [];
      list.push(b);
      byTeam.set(b.teamId, list);
    }
    const names = this.teamStore.teamNameById();
    return [...byTeam.entries()]
      .map(([teamId, bs]) => ({
        teamId,
        teamName: names.get(teamId) ?? `Команда ${teamId}`,
        boards: [...bs].sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  });

  newTitle = '';
  createTeamId = '';
  creating = false;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.boardStore.loadBoards(), this.teamStore.loadTeams()]);
    const admins = this.teamStore.adminTeams();
    if (admins.length && !this.createTeamId) {
      this.createTeamId = admins[0].id;
    }
  }

  async createBoard(): Promise<void> {
    const title = this.newTitle.trim();
    const teamId = this.createTeamId;
    if (!title || !teamId) {
      return;
    }
    this.creating = true;
    try {
      await firstValueFrom(this.api.createBoard({ title, teamId, projectIds: [] }));
      this.newTitle = '';
      await this.boardStore.loadBoards();
    } finally {
      this.creating = false;
    }
  }
}
