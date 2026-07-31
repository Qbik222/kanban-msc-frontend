import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService } from '../../../data/auth-api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { BoardStore } from '../../../state/board.store';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly authApi = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly boardStore = inject(BoardStore);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  pending = false;

  async submit(): Promise<void> {
    this.pending = true;
    try {
      const res = await firstValueFrom(
        this.authApi.register({
          name: this.name,
          email: this.email,
          password: this.password,
        }),
      );
      if (!res.accessToken || !res.csrfToken) {
        throw new Error('Authentication token is missing in register response.');
      }
      this.auth.setSession({
        accessToken: res.accessToken,
        csrfToken: res.csrfToken,
      });
      const user = this.auth.normalizeUser(res.user as Record<string, unknown>);
      this.boardStore.setUser(user);
      await this.router.navigateByUrl('/teams');
    } finally {
      this.pending = false;
    }
  }
}
