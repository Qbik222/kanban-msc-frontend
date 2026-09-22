import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { BoardMemberDto, Card } from '../../../models/board.models';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent implements OnChanges {
  @ViewChild('assigneeRoot') private assigneeRoot?: ElementRef<HTMLElement>;

  @Input({ required: true }) card!: Card;
  @Input() members: BoardMemberDto[] = [];
  @Input() canToggleComplete = false;
  @Input() togglingComplete = false;
  @Output() clicked = new EventEmitter<void>();
  @Output() toggleComplete = new EventEmitter<void>();
  @Output() assigneeChange = new EventEmitter<string>();
  @Output() titleChange = new EventEmitter<string>();

  assigneeMenuOpen = false;
  menuTop = 0;
  menuLeft = 0;
  draftTitle = '';
  titleFocused = false;
  private lastSubmittedTitle: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['card'] || this.titleFocused) {
      return;
    }
    this.draftTitle = this.card.title;
    this.lastSubmittedTitle = null;
  }

  get selectedMember(): BoardMemberDto | null {
    if (!this.card.assigneeId) {
      return null;
    }
    return this.members.find((member) => member.id === this.card.assigneeId) ?? null;
  }

  get assigneeLabel(): string {
    if (!this.card.assigneeId) {
      return 'Unassigned';
    }
    return this.selectedMember?.name || 'Assigned user';
  }

  get assigneeInitial(): string {
    const name = this.selectedMember?.name.trim();
    return name ? name.charAt(0).toUpperCase() : '';
  }

  @HostListener('document:click', ['$event'])
  closeAssigneeMenu(event: MouseEvent): void {
    if (!this.assigneeMenuOpen) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.assigneeRoot?.nativeElement.contains(target)) {
      return;
    }
    this.assigneeMenuOpen = false;
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-assignee-control], [data-title-control]')) {
      return;
    }
    this.clicked.emit();
  }

  toggleAssigneeMenu(anchor: HTMLElement): void {
    if (!this.canToggleComplete) {
      return;
    }
    this.assigneeMenuOpen = !this.assigneeMenuOpen;
    if (!this.assigneeMenuOpen) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    this.menuTop = rect.bottom + 4;
    this.menuLeft = rect.left;
  }

  selectAssignee(userId: string): void {
    this.assigneeMenuOpen = false;
    if (!userId || userId === this.card.assigneeId) {
      return;
    }
    this.assigneeChange.emit(userId);
  }

  onTitleBlur(): void {
    this.titleFocused = false;
    this.commitTitle();
  }

  onTitleEnter(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    this.commitTitle();
    input.blur();
  }

  cancelTitle(input: HTMLInputElement): void {
    this.draftTitle = this.card.title;
    this.lastSubmittedTitle = null;
    input.blur();
  }

  private commitTitle(): void {
    const next = this.draftTitle.trim();
    if (!next) {
      this.draftTitle = this.card.title;
      return;
    }
    this.draftTitle = next;
    if (next === this.card.title || next === this.lastSubmittedTitle) {
      return;
    }
    this.lastSubmittedTitle = next;
    this.titleChange.emit(next);
  }
}
