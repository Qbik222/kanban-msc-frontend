import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  signal,
} from '@angular/core';
import { BoardStore } from '../../state/board.store';
import { roleHasAnyPermission } from '../../state/permissions';

/**
 * Structural directive: shows the template if the current effective role has **any** of the listed permissions.
 * Usage: `*canView="['board:update', 'card:create']"`
 */
@Directive({
  selector: '[canView]',
  standalone: true,
})
export class CanViewDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly store = inject(BoardStore);

  private readonly keys = signal<string[]>([]);

  @Input('canView')
  set canView(keys: string[]) {
    this.keys.set(keys ?? []);
  }

  constructor() {
    effect(() => {
      const role = this.store.effectiveRole();
      const ok = roleHasAnyPermission(role, this.keys());
      this.vcr.clear();
      if (ok) {
        this.vcr.createEmbeddedView(this.templateRef);
      }
    });
  }
}
