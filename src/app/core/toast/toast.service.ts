import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  variant: 'info' | 'error' | 'success';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private seq = 0;

  show(message: string, variant: ToastMessage['variant'] = 'info'): void {
    const id = ++this.seq;
    this.messages.update((list) => [...list, { id, message, variant }]);
    setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((t) => t.id !== id));
  }
}
