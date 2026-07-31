import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card, CardDeadline } from '../../../models/board.models';

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
  @Input()
  set card(value: Card | null) {
    this._card = value;
    this.draftTitle = value?.title ?? '';
    this.draftDescription = value?.description ?? '';
    this.draftPriority = value?.priority;
    this.draftDeadlineStartDate = this.toDateInputValue(value?.deadline?.startDate);
    this.draftDeadlineEndDate = this.toDateInputValue(value?.deadline?.endDate);
  }

  get card(): Card | null {
    return this._card;
  }

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<CardModalSavePayload>();

  private _card: Card | null = null;

  draftTitle = '';
  draftDescription = '';
  draftPriority: 'low' | 'medium' | 'high' | undefined = undefined;
  draftDeadlineStartDate = '';
  draftDeadlineEndDate = '';

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
