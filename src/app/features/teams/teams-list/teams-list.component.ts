import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TeamStore } from '../../../state/team.store';

@Component({
  selector: 'app-teams-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './teams-list.component.html',
  styleUrl: './teams-list.component.scss',
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
