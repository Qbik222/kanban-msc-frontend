import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoardApiService } from '../../../data/board-api.service';
import { BoardStore } from '../../../state/board.store';
import { TeamStore } from '../../../state/team.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-board-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './board-list.component.html',
  styleUrl: './board-list.component.scss',
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
        teamName: names.get(teamId) ?? `Team ${teamId}`,
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
