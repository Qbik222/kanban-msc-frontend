import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.bootstrapSession();
  if (auth.hasSession()) {
    return true;
  }
  return router.parseUrl('/login');
};
