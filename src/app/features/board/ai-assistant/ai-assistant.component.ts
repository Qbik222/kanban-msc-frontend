import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AiBridgeService } from '../../../ai/ai-bridge.service';
import { BoardStore } from '../../../state/board.store';
import { roleHasAnyPermission } from '../../../state/permissions';
import { CanViewDirective } from '../../../shared/directives/can-view.directive';

const AI_ACTION_PERMISSIONS: Record<string, string> = {
  moveCard: 'card:move',
  updateCard: 'card:update',
  createCard: 'card:create',
  deleteCard: 'card:delete',
};

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [FormsModule, CanViewDirective],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
})
export class AiAssistantComponent {
  readonly bridge = inject(AiBridgeService);
  readonly boardStore = inject(BoardStore);

  open = signal(false);
  action = 'moveCard';
  payloadJson = '';
  running = signal(false);

  canRunSelectedAction(): boolean {
    const permission = AI_ACTION_PERMISSIONS[this.action];
    if (!permission) {
      return false;
    }
    return roleHasAnyPermission(this.boardStore.effectiveRole(), [permission]);
  }

  async run(): Promise<void> {
    let payload: unknown;
    try {
      payload = this.payloadJson ? JSON.parse(this.payloadJson) : {};
    } catch {
      return;
    }
    this.running.set(true);
    try {
      await this.bridge.executeAiAction(this.action, payload);
    } finally {
      this.running.set(false);
    }
  }
}
