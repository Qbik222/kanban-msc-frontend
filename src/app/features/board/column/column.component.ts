import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
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
export class ColumnComponent implements OnDestroy {
  @ViewChild('skeletonTitleInput') private skeletonTitleInput?: ElementRef<HTMLInputElement>;
  @ViewChild('assigneeRoot') private assigneeRoot?: ElementRef<HTMLElement>;
  @ViewChild('assigneePanel') private assigneePanel?: ElementRef<HTMLElement>;
  @ViewChild('deadlineRoot') private deadlineRoot?: ElementRef<HTMLElement>;
  @ViewChild('deadlinePanel') private deadlinePanel?: ElementRef<HTMLElement>;

  @Input({ required: true }) column!: Column;
  @Input() canCreateCard = false;
  @Input() canMoveCards = false;
  @Input() canUpdateCards = false;
  @Input() members: BoardMemberDto[] = [];
  @Input() creatingCard = false;
  @Input() togglingCardIds: ReadonlySet<string> = new Set();
  @Input()
  set showSkeleton(value: boolean) {
    const opened = value && !this._showSkeleton;
    this._showSkeleton = value;
    if (!value) {
      this.setAssigneeOpen(false);
      this.setDeadlineOpen(false);
      this.deadlineError = '';
    }
    if (opened) {
      setTimeout(() => this.skeletonTitleInput?.nativeElement.focus());
    }
  }

  get showSkeleton(): boolean {
    return this._showSkeleton;
  }

  private _showSkeleton = false;
  @Input() skeletonCardId: string | null = null;
  @Input() skeletonTitle = '';
  @Input() skeletonAssigneeId = '';
  @Input() skeletonStartDate = '';
  @Input() skeletonEndDate = '';

  @Output() dropped = new EventEmitter<CdkDragDrop<Card[]>>();
  @Output() addCard = new EventEmitter<void>();
  @Output() openCard = new EventEmitter<Card>();
  @Output() toggleCardComplete = new EventEmitter<Card>();
  @Output() assigneeChange = new EventEmitter<{ card: Card; userId: string }>();
  @Output() titleChange = new EventEmitter<{ card: Card; title: string }>();
  @Output() deadlineChange = new EventEmitter<{ card: Card; deadline: { startDate: string; endDate: string } | null }>();
  @Output() skeletonTitleChange = new EventEmitter<string>();
  @Output() skeletonAssigneeChange = new EventEmitter<string>();
  @Output() skeletonStartDateChange = new EventEmitter<string>();
  @Output() skeletonEndDateChange = new EventEmitter<string>();
  @Output() saveSkeleton = new EventEmitter<void>();
  @Output() cancelSkeleton = new EventEmitter<void>();

  assigneeMenuOpen = false;
  menuTop = 0;
  menuLeft = 0;
  deadlineOpen = false;
  deadlineTop = 0;
  deadlineLeft = 0;
  deadlineError = '';
  readonly weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  private viewportWatching = false;
  private readonly refitListener = () => {
    this.refitAssigneeMenu();
    this.refitDeadlinePanel();
  };

  ngOnDestroy(): void {
    this.unbindViewportWatch();
  }

  get skeletonAssignee(): BoardMemberDto | null {
    if (!this.skeletonAssigneeId) {
      return null;
    }
    return this.members.find((member) => member.id === this.skeletonAssigneeId) ?? null;
  }

  get skeletonAssigneeLabel(): string {
    if (!this.skeletonAssigneeId) {
      return 'Unassigned';
    }
    return this.skeletonAssignee?.name || 'Assigned user';
  }

  get skeletonAssigneeInitial(): string {
    const name = this.skeletonAssignee?.name.trim();
    return name ? name.charAt(0).toUpperCase() : '';
  }

  get skeletonDeadlineOverdue(): boolean {
    return !!this.skeletonEndDate && isCalendarDay(this.skeletonEndDate) && this.skeletonEndDate < formatLocalDay(new Date());
  }

  get skeletonDeadlineLabel(): string {
    const start = this.skeletonStartDate;
    const end = this.skeletonEndDate;
    if (isCalendarDay(start) && isCalendarDay(end)) {
      return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
    }
    if (isCalendarDay(start)) {
      return `Start ${formatDayLabel(start)}`;
    }
    if (isCalendarDay(end)) {
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

  toggleAssigneeMenu(anchor: HTMLElement): void {
    const nextOpen = !this.assigneeMenuOpen;
    if (nextOpen) {
      this.setDeadlineOpen(false);
    }
    this.setAssigneeOpen(nextOpen);
    if (!nextOpen) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    this.menuTop = rect.bottom + 4;
    this.menuLeft = rect.left;
    this.scheduleViewportFit();
  }

  selectAssignee(userId: string): void {
    this.setAssigneeOpen(false);
    if (!userId || userId === this.skeletonAssigneeId) {
      return;
    }
    this.skeletonAssigneeChange.emit(userId);
  }

  revertSkeletonTitle(input: HTMLInputElement): void {
    const title = this.column.cards.find((card) => card.id === this.skeletonCardId)?.title ?? '';
    this.skeletonTitleChange.emit(title);
    input.blur();
  }

  requestSave(): void {
    if (!this.skeletonTitle.trim()) {
      return;
    }
    const start = this.skeletonStartDate.trim();
    const end = this.skeletonEndDate.trim();
    if (start || end) {
      if (!isCalendarDay(start) || !isCalendarDay(end)) {
        this.deadlineError = 'Choose both start and end dates';
        this.openDeadline();
        return;
      }
      if (end < start) {
        this.deadlineError = 'endDate cannot be earlier than startDate';
        this.openDeadline();
        return;
      }
    }
    this.deadlineError = '';
    this.setDeadlineOpen(false);
    this.saveSkeleton.emit();
  }

  toggleDeadline(anchor: HTMLElement): void {
    if (this.deadlineOpen) {
      this.setDeadlineOpen(false);
      return;
    }
    this.openDeadline(anchor);
  }

  shiftMonth(delta: number): void {
    const next = new Date(this.calendarYear, this.calendarMonth + delta, 1);
    this.calendarYear = next.getFullYear();
    this.calendarMonth = next.getMonth();
    this.scheduleDeadlineFit();
  }

  selectCalendarDay(date: string): void {
    if (!this.skeletonStartDate || this.skeletonEndDate) {
      this.skeletonStartDateChange.emit(date);
      this.skeletonEndDateChange.emit('');
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    if (date < this.skeletonStartDate) {
      this.skeletonStartDateChange.emit(date);
      this.skeletonEndDateChange.emit('');
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    this.skeletonEndDateChange.emit(date);
    this.deadlineError = '';
    this.scheduleDeadlineFit();
  }

  onDeadlineInput(field: 'start' | 'end', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'start') {
      this.skeletonStartDateChange.emit(value);
    } else {
      this.skeletonEndDateChange.emit(value);
    }
  }

  commitDeadlineInputs(): void {
    const start = this.skeletonStartDate.trim();
    const end = this.skeletonEndDate.trim();
    if (!isCalendarDay(start) || !isCalendarDay(end)) {
      return;
    }
    if (end < start) {
      this.deadlineError = 'endDate cannot be earlier than startDate';
      this.scheduleDeadlineFit();
      return;
    }
    this.deadlineError = '';
    this.scheduleDeadlineFit();
  }

  clearDeadline(): void {
    this.skeletonStartDateChange.emit('');
    this.skeletonEndDateChange.emit('');
    this.deadlineError = '';
    this.scheduleDeadlineFit();
  }

  dayClass(date: string, inMonth: boolean): string {
    const selected = date === this.skeletonStartDate || date === this.skeletonEndDate;
    const inRange =
      isCalendarDay(this.skeletonStartDate) &&
      isCalendarDay(this.skeletonEndDate) &&
      date >= this.skeletonStartDate &&
      date <= this.skeletonEndDate;
    if (selected) {
      return 'bg-sky-600 text-white';
    }
    if (inRange) {
      return 'bg-sky-900 text-sky-100';
    }
    return inMonth ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-800';
  }

  private openDeadline(anchor?: HTMLElement): void {
    this.setAssigneeOpen(false);
    this.setDeadlineOpen(true);
    const target = anchor ?? this.deadlineRoot?.nativeElement.querySelector('button');
    if (target) {
      const rect = target.getBoundingClientRect();
      this.deadlineTop = rect.bottom + 4;
      this.deadlineLeft = rect.left;
    }
    const focusDay = this.skeletonStartDate || this.skeletonEndDate || formatLocalDay(new Date());
    const [year, month] = focusDay.split('-').map(Number);
    if (year && month) {
      this.calendarYear = year;
      this.calendarMonth = month - 1;
    }
    this.scheduleDeadlineFit();
  }

  private setDeadlineOpen(open: boolean): void {
    if (this.deadlineOpen === open) {
      return;
    }
    this.deadlineOpen = open;
    this.syncViewportWatch();
  }

  private setAssigneeOpen(open: boolean): void {
    if (this.assigneeMenuOpen === open) {
      return;
    }
    this.assigneeMenuOpen = open;
    this.syncViewportWatch();
  }

  private syncViewportWatch(): void {
    const watch = this.deadlineOpen || this.assigneeMenuOpen;
    if (watch === this.viewportWatching) {
      return;
    }
    this.viewportWatching = watch;
    if (watch) {
      document.addEventListener('scroll', this.refitListener, true);
      window.addEventListener('resize', this.refitListener);
      return;
    }
    this.unbindViewportWatch();
  }

  private unbindViewportWatch(): void {
    document.removeEventListener('scroll', this.refitListener, true);
    window.removeEventListener('resize', this.refitListener);
  }

  private scheduleDeadlineFit(): void {
    this.scheduleViewportFit();
  }

  private scheduleViewportFit(): void {
    setTimeout(() => {
      this.refitAssigneeMenu();
      this.refitDeadlinePanel();
    });
  }

  private refitAssigneeMenu(): void {
    const panel = this.assigneePanel?.nativeElement;
    const anchor = this.assigneeRoot?.nativeElement.querySelector('button');
    if (!this.assigneeMenuOpen || !panel || !anchor) {
      return;
    }
    const position = this.placeInViewport(anchor, panel);
    this.menuTop = position.top;
    this.menuLeft = position.left;
  }

  private refitDeadlinePanel(): void {
    const panel = this.deadlinePanel?.nativeElement;
    const anchor = this.deadlineRoot?.nativeElement.querySelector('button');
    if (!this.deadlineOpen || !panel || !anchor) {
      return;
    }
    const position = this.placeInViewport(anchor, panel);
    this.deadlineTop = position.top;
    this.deadlineLeft = position.left;
  }

  private placeInViewport(anchor: HTMLElement, panel: HTMLElement): { top: number; left: number } {
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
    return { top, left };
  }
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
