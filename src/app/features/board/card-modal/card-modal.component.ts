import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardMemberDto, Card } from '../../../models/board.models';

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './card-modal.component.html',
  styleUrl: './card-modal.component.scss',
})
export class CardModalComponent implements OnDestroy {
  @ViewChild('deadlineRoot') private deadlineRoot?: ElementRef<HTMLElement>;
  @ViewChild('deadlinePanel') private deadlinePanel?: ElementRef<HTMLElement>;

  @Input() canToggleComplete = false;
  @Input() canArchive = false;
  @Input() canPurge = false;
  @Input() togglingComplete = false;
  @Input() members: BoardMemberDto[] = [];

  @Input()
  set card(value: Card | null) {
    const sameCard = !!value && this._card?.id === value.id;
    this._card = value;
    if (sameCard && value) {
      this.draftAssigneeId = value.assigneeId ?? '';
      if (!this.deadlineOpen) {
        this.draftDeadlineStartDate = calendarDay(value.deadline?.startDate);
        this.draftDeadlineEndDate = calendarDay(value.deadline?.endDate);
      }
      if (!this.titleFocused) {
        this.draftTitle = value.title;
        this.lastSubmittedTitle = null;
      }
      if (!this.descriptionFocused) {
        this.draftDescription = value.description ?? '';
        this.lastSubmittedDescription = null;
      }
      this.draftPriority = value.priority;
      return;
    }
    this.draftTitle = value?.title ?? '';
    this.draftDescription = value?.description ?? '';
    this.draftPriority = value?.priority;
    this.draftDeadlineStartDate = calendarDay(value?.deadline?.startDate);
    this.draftDeadlineEndDate = calendarDay(value?.deadline?.endDate);
    this.draftAssigneeId = value?.assigneeId ?? '';
    this.titleFocused = false;
    this.descriptionFocused = false;
    this.lastSubmittedTitle = null;
    this.lastSubmittedDescription = null;
    this.assigneeMenuOpen = false;
    this.actionsMenuOpen = false;
    this.pendingAction = null;
    this.setDeadlineOpen(false);
  }

  get card(): Card | null {
    return this._card;
  }

  @Output() close = new EventEmitter<void>();
  @Output() toggleComplete = new EventEmitter<Card>();
  @Output() assigneeChange = new EventEmitter<string>();
  @Output() titleChange = new EventEmitter<string>();
  @Output() descriptionChange = new EventEmitter<string>();
  @Output() priorityChange = new EventEmitter<'low' | 'medium' | 'high' | null>();
  @Output() deadlineChange = new EventEmitter<{ startDate: string; endDate: string } | null>();
  @Output() archive = new EventEmitter<Card>();
  @Output() purge = new EventEmitter<Card>();
  @Output() restore = new EventEmitter<Card>();

  private _card: Card | null = null;

  draftTitle = '';
  draftDescription = '';
  draftPriority: 'low' | 'medium' | 'high' | undefined = undefined;
  titleFocused = false;
  descriptionFocused = false;
  private lastSubmittedTitle: string | null = null;
  private lastSubmittedDescription: string | null = null;
  draftDeadlineStartDate = '';
  draftDeadlineEndDate = '';
  draftAssigneeId = '';
  assigneeMenuOpen = false;
  actionsMenuOpen = false;
  pendingAction: 'archive' | 'purge' | null = null;
  deadlineOpen = false;
  deadlineTop = 0;
  deadlineLeft = 0;
  deadlineError = '';
  readonly weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  private readonly refitDeadlineListener = () => this.refitDeadlinePanel();

  ngOnDestroy(): void {
    this.unbindDeadlineViewport();
  }

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

  get deadlineOverdue(): boolean {
    if (this.card?.taskComplete) {
      return false;
    }
    const end = calendarDay(this.card?.deadline?.endDate);
    return !!end && end < formatLocalDay(new Date());
  }

  get deadlineLabel(): string {
    const start = calendarDay(this.card?.deadline?.startDate);
    const end = calendarDay(this.card?.deadline?.endDate);
    if (start && end) {
      return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
    }
    if (start) {
      return `Start ${formatDayLabel(start)}`;
    }
    if (end) {
      return `Due ${formatDayLabel(end)}`;
    }
    return 'No due date';
  }

  get calendarTitle(): string {
    return new Date(this.calendarYear, this.calendarMonth, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  get calendarDays(): { date: string; dayNumber: number; inMonth: boolean }[] {
    const firstWeekday = (new Date(this.calendarYear, this.calendarMonth, 1).getDay() + 6) % 7;
    const cursor = new Date(this.calendarYear, this.calendarMonth, 1 - firstWeekday);
    return Array.from({ length: 42 }, () => {
      const date = formatLocalDay(cursor);
      const day = { date, dayNumber: cursor.getDate(), inMonth: cursor.getMonth() === this.calendarMonth };
      cursor.setDate(cursor.getDate() + 1);
      return day;
    });
  }

  dismissOverlays(): void {
    this.assigneeMenuOpen = false;
    this.actionsMenuOpen = false;
    this.pendingAction = null;
    this.setDeadlineOpen(false);
  }

  toggleActionsMenu(): void {
    this.actionsMenuOpen = !this.actionsMenuOpen;
    this.pendingAction = null;
  }

  confirmPendingAction(): void {
    if (!this.card) {
      return;
    }
    if (this.pendingAction === 'archive') {
      this.archive.emit(this.card);
    } else if (this.pendingAction === 'purge') {
      this.purge.emit(this.card);
    }
    this.actionsMenuOpen = false;
    this.pendingAction = null;
  }

  restoreCard(): void {
    if (!this.card?.isDeleted) {
      return;
    }
    this.actionsMenuOpen = false;
    this.restore.emit(this.card);
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

  onTitleEnter(event: Event, input: HTMLInputElement): void {
    event.preventDefault();
    this.commitTitle();
    input.blur();
  }

  onTitleBlur(): void {
    this.titleFocused = false;
    this.commitTitle();
  }

  cancelTitle(input: HTMLInputElement): void {
    this.draftTitle = this.card?.title ?? '';
    this.lastSubmittedTitle = null;
    input.blur();
  }

  onDescriptionBlur(): void {
    this.descriptionFocused = false;
    this.commitDescription();
  }

  cancelDescription(textarea: HTMLTextAreaElement): void {
    this.draftDescription = this.card?.description ?? '';
    this.lastSubmittedDescription = null;
    textarea.blur();
  }

  onPriorityChange(value: 'low' | 'medium' | 'high' | null | undefined): void {
    const next = value ?? undefined;
    this.draftPriority = next;
    if (!this.canToggleComplete || !this.card || (this.card.priority ?? undefined) === next) {
      return;
    }
    this.priorityChange.emit(next ?? null);
  }

  toggleDeadline(anchor: HTMLElement): void {
    if (!this.canToggleComplete) {
      return;
    }
    const nextOpen = !this.deadlineOpen;
    this.setDeadlineOpen(nextOpen);
    if (!nextOpen) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    this.deadlineTop = rect.bottom + 4;
    this.deadlineLeft = rect.left;
    const focusDay = this.draftDeadlineStartDate || this.draftDeadlineEndDate || formatLocalDay(new Date());
    const [year, month] = focusDay.split('-').map(Number);
    this.calendarYear = year;
    this.calendarMonth = month - 1;
    this.scheduleDeadlineFit();
  }

  shiftMonth(delta: number): void {
    const next = new Date(this.calendarYear, this.calendarMonth + delta, 1);
    this.calendarYear = next.getFullYear();
    this.calendarMonth = next.getMonth();
  }

  selectCalendarDay(date: string): void {
    if (!this.draftDeadlineStartDate || this.draftDeadlineEndDate) {
      this.draftDeadlineStartDate = date;
      this.draftDeadlineEndDate = '';
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    if (date < this.draftDeadlineStartDate) {
      this.draftDeadlineStartDate = date;
      this.draftDeadlineEndDate = '';
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    this.draftDeadlineEndDate = date;
    this.commitDeadline();
  }

  onDeadlineInput(field: 'start' | 'end', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'start') {
      this.draftDeadlineStartDate = value;
    } else {
      this.draftDeadlineEndDate = value;
    }
  }

  commitDeadline(): void {
    if (!isCalendarDay(this.draftDeadlineStartDate) || !isCalendarDay(this.draftDeadlineEndDate)) {
      return;
    }
    if (this.draftDeadlineEndDate < this.draftDeadlineStartDate) {
      this.deadlineError = 'endDate cannot be earlier than startDate';
      this.scheduleDeadlineFit();
      return;
    }
    this.deadlineError = '';
    const currentStart = calendarDay(this.card?.deadline?.startDate);
    const currentEnd = calendarDay(this.card?.deadline?.endDate);
    if (this.draftDeadlineStartDate === currentStart && this.draftDeadlineEndDate === currentEnd) {
      return;
    }
    this.deadlineChange.emit({
      startDate: this.draftDeadlineStartDate,
      endDate: this.draftDeadlineEndDate,
    });
    this.scheduleDeadlineFit();
  }

  clearDeadline(): void {
    this.draftDeadlineStartDate = '';
    this.draftDeadlineEndDate = '';
    this.deadlineError = '';
    if (!this.card?.deadline?.startDate && !this.card?.deadline?.endDate) {
      return;
    }
    this.deadlineChange.emit(null);
    this.scheduleDeadlineFit();
  }

  dayClass(date: string, inMonth: boolean): string {
    const selected = date === this.draftDeadlineStartDate || date === this.draftDeadlineEndDate;
    const inRange =
      !!this.draftDeadlineStartDate &&
      !!this.draftDeadlineEndDate &&
      date >= this.draftDeadlineStartDate &&
      date <= this.draftDeadlineEndDate;
    if (selected) {
      return 'bg-sky-600 text-white';
    }
    if (inRange) {
      return 'bg-sky-900 text-sky-100';
    }
    return inMonth ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-800';
  }

  private commitTitle(): void {
    const next = this.draftTitle.trim();
    if (!this.canToggleComplete || !next) {
      this.draftTitle = this.card?.title ?? '';
      return;
    }
    this.draftTitle = next;
    if (!this.card || next === this.card.title || next === this.lastSubmittedTitle) {
      return;
    }
    this.lastSubmittedTitle = next;
    this.titleChange.emit(next);
  }

  private commitDescription(): void {
    if (!this.canToggleComplete || !this.card) {
      this.draftDescription = this.card?.description ?? '';
      return;
    }
    const next = this.draftDescription.trim();
    this.draftDescription = next;
    if (next === (this.card.description ?? '') || next === this.lastSubmittedDescription) {
      return;
    }
    this.lastSubmittedDescription = next;
    this.descriptionChange.emit(next);
  }

  private setDeadlineOpen(open: boolean): void {
    if (this.deadlineOpen === open) {
      return;
    }
    this.deadlineOpen = open;
    if (open) {
      document.addEventListener('scroll', this.refitDeadlineListener, true);
      window.addEventListener('resize', this.refitDeadlineListener);
      return;
    }
    this.unbindDeadlineViewport();
  }

  private unbindDeadlineViewport(): void {
    document.removeEventListener('scroll', this.refitDeadlineListener, true);
    window.removeEventListener('resize', this.refitDeadlineListener);
  }

  private scheduleDeadlineFit(): void {
    setTimeout(() => this.refitDeadlinePanel());
  }

  private refitDeadlinePanel(): void {
    const panel = this.deadlinePanel?.nativeElement;
    const anchor = this.deadlineRoot?.nativeElement.querySelector('button');
    if (!this.deadlineOpen || !panel || !anchor) {
      return;
    }
    const margin = 8;
    const anchorRect = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let top = anchorRect.bottom + 4;
    if (top + height > window.innerHeight - margin) {
      const above = anchorRect.top - height - 4;
      top = above >= margin ? above : margin;
    }
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - margin - height);
    }
    let left = anchorRect.left;
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - margin - width;
    }
    if (left < margin) {
      left = margin;
    }
    this.deadlineTop = top;
    this.deadlineLeft = left;
  }
}

function calendarDay(raw: string | Date | undefined): string {
  if (!raw) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
  }
  return formatLocalDay(raw);
}

function formatLocalDay(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
