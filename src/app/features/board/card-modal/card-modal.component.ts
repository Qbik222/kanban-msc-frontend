import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardMemberDto, Card, CardDeadline } from '../../../models/board.models';

export interface CardModalSavePayload {
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  deadline?: CardDeadline;
}

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './card-modal.component.html',
  styleUrl: './card-modal.component.scss',
})
export class CardModalComponent {
  @Input() canToggleComplete = false;
  @Input() togglingComplete = false;
  @Input() members: BoardMemberDto[] = [];

  @Input()
  set card(value: Card | null) {
    const sameCard = !!value && this._card?.id === value.id;
    this._card = value;
    if (sameCard) {
      this.draftAssigneeId = value.assigneeId ?? '';
      return;
    }
    this.draftTitle = value?.title ?? '';
    this.draftDescription = value?.description ?? '';
    this.draftPriority = value?.priority;
    this.draftDeadlineStartDate = this.toDateInputValue(value?.deadline?.startDate);
    this.draftDeadlineEndDate = this.toDateInputValue(value?.deadline?.endDate);
    this.draftAssigneeId = value?.assigneeId ?? '';
    this.assigneeMenuOpen = false;
  }

  get card(): Card | null {
    return this._card;
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CardModalSavePayload>();
  @Output() toggleComplete = new EventEmitter<Card>();
  @Output() assigneeChange = new EventEmitter<string>();

  private _card: Card | null = null;

  draftTitle = '';
  draftDescription = '';
  draftPriority: 'low' | 'medium' | 'high' | undefined = undefined;
  draftDeadlineStartDate = '';
  draftDeadlineEndDate = '';
  draftAssigneeId = '';
  assigneeMenuOpen = false;

  get selectedMember(): BoardMemberDto | null {
    if (!this.draftAssigneeId) {
      return null;
    }
    return this.members.find((member) => member.id === this.draftAssigneeId) ?? null;
  }

  get assigneeLabel(): string {
    if (!this.draftAssigneeId) {
      return 'Unassigned';
    }
    return this.selectedMember?.name || 'Assigned user';
  }

  get assigneeInitial(): string {
    const name = this.selectedMember?.name.trim();
    return name ? name.charAt(0).toUpperCase() : '';
  }

  get projectsLabel(): string {
    const count = this.card?.projectIds.length ?? 0;
    if (!count) {
      return 'No projects';
    }
    return count === 1 ? '1 project' : `${count} projects`;
  }

  selectAssignee(userId: string): void {
    this.assigneeMenuOpen = false;
    if (!userId || userId === this.draftAssigneeId) {
      return;
    }
    this.draftAssigneeId = userId;
    this.assigneeChange.emit(userId);
  }

  revertAssignee(): void {
    this.draftAssigneeId = this.card?.assigneeId ?? '';
  }

  submit(): void {
    if (!this.draftTitle.trim()) {
      return;
    }
    this.save.emit({
      title: this.draftTitle.trim(),
      description: this.draftDescription.trim(),
      priority: this.draftPriority,
      deadline:
        this.draftDeadlineStartDate || this.draftDeadlineEndDate
          ? {
              startDate: this.draftDeadlineStartDate || undefined,
              endDate: this.draftDeadlineEndDate || undefined,
            }
          : undefined,
    });
  }

  private toDateInputValue(raw: string | Date | undefined): string {
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }
}
