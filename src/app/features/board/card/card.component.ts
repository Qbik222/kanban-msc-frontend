import { Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { BoardMemberDto, Card } from '../../../models/board.models';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class CardComponent implements OnChanges, OnDestroy {
  @ViewChild('assigneeRoot') private assigneeRoot?: ElementRef<HTMLElement>;
  @ViewChild('assigneePanel') private assigneePanel?: ElementRef<HTMLElement>;
  @ViewChild('deadlineRoot') private deadlineRoot?: ElementRef<HTMLElement>;
  @ViewChild('deadlinePanel') private deadlinePanel?: ElementRef<HTMLElement>;
  @ViewChild('actionsRoot') private actionsRoot?: ElementRef<HTMLElement>;
  @ViewChild('actionsPanel') private actionsPanel?: ElementRef<HTMLElement>;

  @Input({ required: true }) card!: Card;
  @Input() members: BoardMemberDto[] = [];
  @Input() canToggleComplete = false;
  @Input() canArchive = false;
  @Input() canPurge = false;
  @Input() togglingComplete = false;
  @Output() clicked = new EventEmitter<void>();
  @Output() toggleComplete = new EventEmitter<void>();
  @Output() archive = new EventEmitter<void>();
  @Output() purge = new EventEmitter<void>();
  @Output() assigneeChange = new EventEmitter<string | null>();
  @Output() titleChange = new EventEmitter<string>();
  @Output() deadlineChange = new EventEmitter<{ startDate: string; endDate: string } | null>();

  readonly weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  assigneeMenuOpen = false;
  actionsMenuOpen = false;
  actionsTop = 0;
  actionsLeft = 0;
  pendingAction: 'archive' | 'purge' | null = null;
  menuTop = 0;
  menuLeft = 0;
  draftTitle = '';
  titleFocused = false;
  deadlineOpen = false;
  deadlineTop = 0;
  deadlineLeft = 0;
  draftStart = '';
  draftEnd = '';
  deadlineError = '';
  calendarYear = new Date().getFullYear();
  calendarMonth = new Date().getMonth();
  private lastSubmittedTitle: string | null = null;
  private viewportWatching = false;
  private readonly refitDeadlineListener = () => {
    this.refitDeadlinePanel();
    this.refitAssigneeMenu();
    this.refitActionsMenu();
  };

  ngOnDestroy(): void {
    this.unbindDeadlineViewport();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['card']) {
      return;
    }
    if (!this.titleFocused) {
      this.draftTitle = this.card.title;
      this.lastSubmittedTitle = null;
    }
    this.draftStart = calendarDay(this.card.deadline?.startDate);
    this.draftEnd = calendarDay(this.card.deadline?.endDate);
    this.deadlineError = '';
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

  get deadlineOverdue(): boolean {
    if (this.card.taskComplete) {
      return false;
    }
    const end = calendarDay(this.card.deadline?.endDate);
    return !!end && end < formatLocalDay(new Date());
  }

  get deadlineLabel(): string {
    const start = calendarDay(this.card.deadline?.startDate);
    const end = calendarDay(this.card.deadline?.endDate);
    if (start && end) {
      return `${formatDayLabel(start)} - ${formatDayLabel(end)}`;
    }
    if (start) {
      return `Start ${formatDayLabel(start)}`;
    }
    if (end) {
      return `Due ${formatDayLabel(end)}`;
    }
    return 'No deadline';
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

  @HostListener('document:click', ['$event'])
  closeFloatingMenus(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (this.assigneeMenuOpen && !(target && this.assigneeRoot?.nativeElement.contains(target))) {
      this.assigneeMenuOpen = false;
      this.syncViewportWatch();
    }
    if (this.deadlineOpen && !(target && this.deadlineRoot?.nativeElement.contains(target))) {
      this.setDeadlineOpen(false);
    }
    if (this.actionsMenuOpen && !(target && this.actionsRoot?.nativeElement.contains(target))) {
      this.closeActionsMenu();
    }
  }

  onCardClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-assignee-control], [data-title-control], [data-deadline-control], [data-actions-control]')) {
      return;
    }
    this.clicked.emit();
  }

  toggleActionsMenu(anchor: HTMLElement): void {
    const nextOpen = !this.actionsMenuOpen;
    this.actionsMenuOpen = nextOpen;
    this.pendingAction = null;
    this.syncViewportWatch();
    if (!nextOpen) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    this.actionsTop = rect.bottom + 4;
    this.actionsLeft = rect.right - 176;
    setTimeout(() => this.refitActionsMenu());
  }

  confirmPendingAction(): void {
    if (this.pendingAction === 'archive') {
      this.archive.emit();
    } else if (this.pendingAction === 'purge') {
      this.purge.emit();
    }
    this.closeActionsMenu();
  }

  toggleAssigneeMenu(anchor: HTMLElement): void {
    if (!this.canToggleComplete) {
      return;
    }
    this.assigneeMenuOpen = !this.assigneeMenuOpen;
    this.syncViewportWatch();
    if (!this.assigneeMenuOpen) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    this.menuTop = rect.bottom + 4;
    this.menuLeft = rect.left;
    setTimeout(() => this.refitAssigneeMenu());
  }

  selectAssignee(userId: string | null): void {
    this.assigneeMenuOpen = false;
    if (userId === null) {
      if (!this.card.assigneeId) {
        return;
      }
      this.assigneeChange.emit(null);
      return;
    }
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
    const focusDay = this.draftStart || this.draftEnd || formatLocalDay(new Date());
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
    if (!this.draftStart || this.draftEnd) {
      this.draftStart = date;
      this.draftEnd = '';
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    if (date < this.draftStart) {
      this.draftStart = date;
      this.draftEnd = '';
      this.deadlineError = '';
      this.scheduleDeadlineFit();
      return;
    }
    this.draftEnd = date;
    this.commitDeadline();
  }

  onDeadlineInput(field: 'start' | 'end', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'start') {
      this.draftStart = value;
    } else {
      this.draftEnd = value;
    }
  }

  commitDeadline(): void {
    if (!isCalendarDay(this.draftStart) || !isCalendarDay(this.draftEnd)) {
      return;
    }
    if (this.draftEnd < this.draftStart) {
      this.deadlineError = 'endDate cannot be earlier than startDate';
      this.scheduleDeadlineFit();
      return;
    }
    this.deadlineError = '';
    const currentStart = calendarDay(this.card.deadline?.startDate);
    const currentEnd = calendarDay(this.card.deadline?.endDate);
    if (this.draftStart === currentStart && this.draftEnd === currentEnd) {
      return;
    }
    this.deadlineChange.emit({ startDate: this.draftStart, endDate: this.draftEnd });
    this.scheduleDeadlineFit();
  }

  clearDeadline(): void {
    this.draftStart = '';
    this.draftEnd = '';
    this.deadlineError = '';
    if (!this.card.deadline?.startDate && !this.card.deadline?.endDate) {
      return;
    }
    this.deadlineChange.emit(null);
    this.scheduleDeadlineFit();
  }

  dayClass(date: string, inMonth: boolean): string {
    const selected = date === this.draftStart || date === this.draftEnd;
    const inRange = !!this.draftStart && !!this.draftEnd && date >= this.draftStart && date <= this.draftEnd;
    if (selected) {
      return 'bg-sky-600 text-white';
    }
    if (inRange) {
      return 'bg-sky-900 text-sky-100';
    }
    return inMonth ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-800';
  }

  private setDeadlineOpen(open: boolean): void {
    if (this.deadlineOpen === open) {
      return;
    }
    this.deadlineOpen = open;
    this.syncViewportWatch();
  }

  private syncViewportWatch(): void {
    const watch = this.deadlineOpen || this.assigneeMenuOpen || this.actionsMenuOpen;
    if (watch === this.viewportWatching) {
      return;
    }
    this.viewportWatching = watch;
    if (watch) {
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

  private closeActionsMenu(): void {
    this.actionsMenuOpen = false;
    this.pendingAction = null;
    this.syncViewportWatch();
  }

  private refitActionsMenu(): void {
    const panel = this.actionsPanel?.nativeElement;
    const anchor = this.actionsRoot?.nativeElement.querySelector('button');
    if (!this.actionsMenuOpen || !panel || !anchor) {
      return;
    }
    const position = this.placeInViewport(anchor, panel);
    this.actionsTop = position.top;
    this.actionsLeft = position.left;
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

function calendarDay(raw: string | Date | undefined): string {
  if (!raw) {
    return '';
  }
  if (typeof raw === 'string') {
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? '';
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
