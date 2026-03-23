import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../toast/toast.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error(error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Unexpected error';
    this.toast.show(msg, 'error');
  }
}
