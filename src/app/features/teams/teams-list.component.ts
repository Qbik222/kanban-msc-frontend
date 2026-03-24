import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '../../state/team.store';

@Component({
  selector: 'app-teams-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-2 text-2xl font-semibold text-white">Мої команди</h1>
      <p class="mb-6 text-sm text-slate-400">
        Команди ізолюють дошки. Створити дошку може лише адміністратор команди.
      </p>

      <div class="mb-8 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 class="mb-3 text-sm font-medium text-slate-300">Створити команду</h2>
        <div class="flex flex-wrap gap-2">
          <input
            class="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
            placeholder="Назва команди"
            [(ngModel)]="newTeamName"
            name="teamName"
            (keydown.enter)="createTeam()"
          />
          <button
            type="button"
            class="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            [disabled]="creating || !newTeamName.trim()"
            (click)="createTeam()"
          >
            {{ creating ? 'Створення…' : 'Створити' }}
          </button>
        </div>
      </div>

      @if (teamStore.loading() && !teamStore.teams().length) {
        <p class="text-slate-400">Завантаження…</p>
      } @else if (teamStore.error()) {
        <p class="text-red-400">{{ teamStore.error() }}</p>
      } @else if (!teamStore.teams().length) {
        <p class="text-slate-400">Ще немає команд. Створіть першу вище.</p>
      } @else {
        <ul class="flex flex-col gap-2">
          @for (t of teamStore.teams(); track t.id) {
            <li
              class="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3"
            >
              <div>
                <a [routerLink]="['/teams', t.id]" class="font-medium text-white hover:text-emerald-400">{{
                  t.name
                }}</a>
                <p class="mt-0.5 text-xs text-slate-500">
                  Ваша роль: {{ t.role === 'admin' ? 'адмін' : 'учасник' }}
                </p>
              </div>
              @if (t.role === 'admin') {
                <a
                  [routerLink]="['/teams', t.id]"
                  class="text-sm text-emerald-400 hover:underline"
                  >Керування</a
                >
              }
            </li>
          }
        </ul>
      }

      <p class="mt-8 text-sm text-slate-500">
        <a routerLink="/boards" class="text-emerald-400 hover:underline">Перейти до дошок</a>
      </p>
    </div>
  `,
})
export class TeamsListComponent implements OnInit {
  readonly teamStore = inject(TeamStore);

  newTeamName = '';
  creating = false;

  ngOnInit(): void {
    void this.teamStore.loadTeams();
  }

  async createTeam(): Promise<void> {
    const name = this.newTeamName.trim();
    if (!name || this.creating) {
      return;
    }
    this.creating = true;
    try {
      const team = await this.teamStore.createTeam(name);
      if (team) {
        this.newTeamName = '';
      }
    } finally {
      this.creating = false;
    }
  }
}
