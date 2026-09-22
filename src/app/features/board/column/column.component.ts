import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { BoardMemberDto, Column, Card } from '../../../models/board.models';
import { CardComponent } from '../card/card.component';

@Component({
  selector: 'app-column',
  standalone: true,
  imports: [DragDropModule, CardComponent, FormsModule],
  templateUrl: './column.component.html',
  styleUrl: './column.component.scss',
})
export class ColumnComponent {
  @Input({ required: true }) column!: Column;
  @Input() canCreateCard = false;
  @Input() canMoveCards = false;
  @Input() canUpdateCards = false;
  @Input() members: BoardMemberDto[] = [];
  @Input() creatingCard = false;
  @Input() togglingCardIds: ReadonlySet<string> = new Set();
  @Input() showSkeleton = false;
  @Input() skeletonCardId: string | null = null;
  @Input() skeletonTitle = '';
  @Input() skeletonStartDate = '';
  @Input() skeletonEndDate = '';

  @Output() dropped = new EventEmitter<CdkDragDrop<Card[]>>();
  @Output() addCard = new EventEmitter<void>();
  @Output() openCard = new EventEmitter<Card>();
  @Output() toggleCardComplete = new EventEmitter<Card>();
  @Output() assigneeChange = new EventEmitter<{ card: Card; userId: string }>();
  @Output() titleChange = new EventEmitter<{ card: Card; title: string }>();
  @Output() skeletonTitleChange = new EventEmitter<string>();
  @Output() skeletonStartDateChange = new EventEmitter<string>();
  @Output() skeletonEndDateChange = new EventEmitter<string>();
  @Output() saveSkeleton = new EventEmitter<void>();
  @Output() cancelSkeleton = new EventEmitter<void>();
}
