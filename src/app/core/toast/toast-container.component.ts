import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm pointer-events-none">
      @for (t of toast.messages(); track t.id) {
        <div
          class="pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg"
          [class.border-red-800]="t.variant === 'error'"
          [class.bg-red-950]="t.variant === 'error'"
          [class.bg-slate-900]="t.variant !== 'error'"
          [class.border-slate-700]="t.variant !== 'error'"
          [class.border-emerald-800]="t.variant === 'success'"
          [class.bg-emerald-950]="t.variant === 'success'"
        >
          {{ t.message }}
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toast = inject(ToastService);
}
