import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoardMemberDto, Card, CardActivityItem, CardComment } from '../../../models/board.models';

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  templateUrl: './card-modal.component.html',
  styleUrl: './card-modal.component.scss',
})
export class CardModalComponent implements OnDestroy {
  @ViewChild('deadlineRoot') private deadlineRoot?: ElementRef<HTMLElement>;
  @ViewChild('deadlinePanel') private deadlinePanel?: ElementRef<HTMLElement>;
  private commentEditor?: ElementRef<HTMLTextAreaElement>;

  @ViewChild('commentEditor')
  set commentEditorRef(field: ElementRef<HTMLTextAreaElement> | undefined) {
    this.commentEditor = field;
    if (field && Date.now() < this.editLockedUntil) {
      field.nativeElement.focus();
    }
  }

  @Input() canToggleComplete = false;
  @Input() canArchive = false;
  @Input() canPurge = false;
  @Input() canUpdateOwnComments = false;
  @Input() canUpdateAnyComments = false;
  @Input() canCreateComment = false;
  @Input() currentUserId = '';
  @Input() activity: CardActivityItem[] = [];
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
    this.editingCommentId = null;
    this.editingDraft = '';
    this.replyParentId = null;
    this.replyDraft = '';
    this.commentMenuId = null;
    this.newComment = '';
    this.diffItem = null;
    this.diffFrom = '';
    this.diffTo = '';
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
  @Output() assigneeChange = new EventEmitter<string | null>();
  @Output() commentChange = new EventEmitter<{ commentId: string; text: string }>();
  @Output() commentCreate = new EventEmitter<{ text: string; parentCommentId?: string }>();
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
  editingCommentId: string | null = null;
  editingDraft = '';
  private editLockedUntil = 0;
  replyParentId: string | null = null;
  replyDraft = '';
  commentMenuId: string | null = null;
  newComment = '';
  diffItem: CardActivityItem | null = null;
  diffFrom = '';
  diffTo = '';
  private brokenAvatars = new Set<string>();
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
    this.commentMenuId = null;
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

  selectAssignee(userId: string | null): void {
    this.assigneeMenuOpen = false;
    const next = userId ?? '';
    if (next === this.draftAssigneeId) {
      return;
    }
    this.draftAssigneeId = next;
    this.assigneeChange.emit(userId);
  }

  get sortedActivity(): CardActivityItem[] {
    return [...this.activity].sort((left, right) => activityTime(right) - activityTime(left));
  }

  get rootComments(): CardComment[] {
    const comments = this.card?.comments ?? [];
    const ids = new Set(comments.map((comment) => comment._id));
    return comments
      .filter((comment) => !comment.parentCommentId || !ids.has(comment.parentCommentId))
      .sort((left, right) => commentTime(left) - commentTime(right));
  }

  repliesOf(parent: CardComment): CardComment[] {
    return (this.card?.comments ?? [])
      .filter((comment) => comment.parentCommentId === parent._id)
      .sort((left, right) => commentTime(left) - commentTime(right));
  }

  isOwnComment(comment: CardComment): boolean {
    return !!this.currentUserId && (comment.authorId === this.currentUserId || comment.author?.id === this.currentUserId);
  }

  canEditComment(comment: CardComment): boolean {
    return this.isOwnComment(comment) && (this.canUpdateOwnComments || this.canUpdateAnyComments);
  }

  canReplyToComment(comment: CardComment): boolean {
    return !this.isOwnComment(comment) && this.canCreateComment;
  }

  commentAuthorName(comment: CardComment): string {
    return comment.author?.name || this.actorName(comment.authorId);
  }

  commentInitial(comment: CardComment): string {
    const name = this.commentAuthorName(comment).trim();
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  commentAvatar(comment: CardComment): string | null {
    const url = comment.author?.avatarUrl?.trim();
    if (!url || this.brokenAvatars.has(comment._id)) {
      return null;
    }
    return url;
  }

  onAvatarError(commentId: string): void {
    this.brokenAvatars.add(commentId);
  }

  commentDate(comment: CardComment): string {
    if (!comment.createdAt) {
      return '';
    }
    const date = new Date(comment.createdAt);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  toggleCommentMenu(commentId: string): void {
    this.assigneeMenuOpen = false;
    this.actionsMenuOpen = false;
    this.pendingAction = null;
    this.commentMenuId = this.commentMenuId === commentId ? null : commentId;
  }

  startEdit(comment: CardComment): void {
    if (!this.canEditComment(comment)) {
      return;
    }
    this.commentMenuId = null;
    this.replyParentId = null;
    this.replyDraft = '';
    this.editingCommentId = comment._id;
    this.editingDraft = comment.text;
    this.editLockedUntil = Date.now() + 300;
  }

  commitComment(comment: CardComment): void {
    if (this.editingCommentId !== comment._id) {
      return;
    }
    if (Date.now() < this.editLockedUntil) {
      this.commentEditor?.nativeElement.focus();
      return;
    }
    const next = this.editingDraft.trim();
    this.editingCommentId = null;
    this.editingDraft = '';
    if (!next || next === comment.text || !this.card) {
      return;
    }
    this.commentChange.emit({ commentId: comment._id, text: next });
  }

  cancelComment(event: Event): void {
    event.preventDefault();
    this.editingCommentId = null;
    this.editingDraft = '';
  }

  startReply(comment: CardComment): void {
    this.commentMenuId = null;
    this.editingCommentId = null;
    this.editingDraft = '';
    this.replyParentId = comment._id;
    this.replyDraft = '';
  }

  cancelReply(): void {
    this.replyParentId = null;
    this.replyDraft = '';
  }

  submitReply(comment: CardComment): void {
    const text = this.replyDraft.trim();
    if (!text || !this.canCreateComment) {
      return;
    }
    this.replyParentId = null;
    this.replyDraft = '';
    this.commentCreate.emit({ text, parentCommentId: comment._id });
  }

  actorName(actorId: string): string {
    return this.members.find((member) => member.id === actorId)?.name || actorId.slice(0, 8);
  }

  activityText(item: CardActivityItem): string {
    if (item.type === 'assignee_changed') {
      return `${this.actorName(item.actorId)} changed assignee from ${this.assigneeActivityLabel(item.assignee?.fromUserId)} to ${this.assigneeActivityLabel(item.assignee?.toUserId)}`;
    }
    if (item.type === 'deadline_changed') {
      return `${this.actorName(item.actorId)} changed deadline from ${this.deadlineActivityLabel(item.deadline?.from)} to ${this.deadlineActivityLabel(item.deadline?.to)}`;
    }
    return `${this.actorName(item.actorId)} changed description`;
  }

  openDescriptionDiff(item: CardActivityItem): void {
    const pair = descriptionPair(item);
    this.diffFrom = pair.from;
    this.diffTo = pair.to;
    this.diffItem = item;
  }

  get descriptionDiff(): { type: 'same' | 'add' | 'del'; text: string }[] {
    return wordDiff(this.diffFrom, this.diffTo);
  }

  submitComment(): void {
    const text = this.newComment.trim();
    if (!text || !this.canCreateComment) {
      return;
    }
    this.newComment = '';
    this.commentCreate.emit({ text });
  }

  private assigneeActivityLabel(value: unknown): string {
    if (value == null || value === '') {
      return 'Unassigned';
    }
    const id = String(value);
    return this.members.find((member) => member.id === id)?.name || id.slice(0, 8);
  }

  private deadlineActivityLabel(value: unknown): string {
    if (value == null || value === '') {
      return 'none';
    }
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }
    if (typeof value === 'object') {
      const dates = value as { startDate?: string; endDate?: string };
      const start = dates.startDate ? String(dates.startDate).slice(0, 10) : '';
      const end = dates.endDate ? String(dates.endDate).slice(0, 10) : '';
      if (start && end) {
        return `${start} – ${end}`;
      }
      return start || end || 'none';
    }
    return 'none';
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

function activityTime(item: CardActivityItem): number {
  return timestamp(item.createdAt);
}

function commentTime(comment: CardComment): number {
  return timestamp(comment.createdAt);
}

function timestamp(value: string | Date | undefined): number {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function descriptionPair(item: CardActivityItem): { from: string; to: string } {
  return {
    from: item.description?.from ?? '',
    to: item.description?.to ?? '',
  };
}

function wordDiff(from: string, to: string): { type: 'same' | 'add' | 'del'; text: string }[] {
  if (!from && !to) {
    return [];
  }
  const before = from.split(/(\s+)/);
  const after = to.split(/(\s+)/);
  const rows = before.length;
  const cols = after.length;
  const scores = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));
  for (let row = rows - 1; row >= 0; row--) {
    for (let col = cols - 1; col >= 0; col--) {
      scores[row][col] =
        before[row] === after[col]
          ? scores[row + 1][col + 1] + 1
          : Math.max(scores[row + 1][col], scores[row][col + 1]);
    }
  }
  const tokens: { type: 'same' | 'add' | 'del'; text: string }[] = [];
  let row = 0;
  let col = 0;
  while (row < rows && col < cols) {
    if (before[row] === after[col]) {
      tokens.push({ type: 'same', text: before[row] });
      row++;
      col++;
    } else if (scores[row + 1][col] >= scores[row][col + 1]) {
      tokens.push({ type: 'del', text: before[row] });
      row++;
    } else {
      tokens.push({ type: 'add', text: after[col] });
      col++;
    }
  }
  while (row < rows) {
    tokens.push({ type: 'del', text: before[row++] });
  }
  while (col < cols) {
    tokens.push({ type: 'add', text: after[col++] });
  }
  return tokens;
}
