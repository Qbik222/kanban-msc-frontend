import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { filter, map, switchMap, tap } from 'rxjs/operators';
import { firstValueFrom, from } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BoardApiService } from '../../data/board-api.service';
import { BoardStore } from '../../state/board.store';
import { TeamStore } from '../../state/team.store';
import { SocketService } from '../../realtime/socket.service';
import { Card } from '../../models/board.models';
import { TeamMember } from '../../models/team.models';
import { ColumnComponent } from './column.component';
import { AiAssistantComponent } from './ai-assistant';
import { FormsModule } from '@angular/forms';
import { CardModalComponent, CardModalSavePayload } from './card-modal.component';
import { CanViewDirective } from '../../shared/directives/can-view.directive';
import { ToastService } from '../../core/toast/toast.service';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    DragDropModule,
    ColumnComponent,
    AiAssistantComponent,
    FormsModule,
    CardModalComponent,
    CanViewDirective,
  ],
  template: `
    <div class="relative flex h-[calc(100vh-8rem)] flex-col">
      @if (boardStore.loading() && !boardStore.activeBoard()) {
        <p class="text-slate-400">Loading board…</p>
      } @else if (boardStore.error()) {
        <p class="text-red-400">{{ boardStore.error() }}</p>
      } @else if (boardStore.activeBoard()) {
        <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 class="text-xl font-semibold text-white">{{ boardStore.activeBoard()!.title }}</h1>
            <p class="mt-0.5 text-xs text-slate-500">team: {{ boardStore.activeBoard()!.teamId }}</p>
          </div>
          @if (boardStore.canEdit()) {
            <div class="flex items-center gap-2">
              <input
                type="text"
                class="w-56 rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                placeholder="Add column title"
                [(ngModel)]="newColumnTitle"
                [disabled]="creatingColumn"
                (keydown.enter)="createColumn()"
              />
              <button
                type="button"
                class="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="creatingColumn || !newColumnTitle.trim()"
                (click)="createColumn()"
              >
                {{ creatingColumn ? 'Adding…' : 'Add column' }}
              </button>
            </div>
          }
        </div>
        <div *canView="['member:invite']" class="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <span class="text-slate-400">Запросити на дошку:</span>

          <div class="flex flex-col gap-1">
            <input
              type="text"
              class="w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 placeholder:text-slate-500"
              placeholder="Пошук по name/email"
              [(ngModel)]="inviteSearch"
              (ngModelChange)="onInviteSearchChange($event)"
              [disabled]="invitingMember"
            />

            <select
              class="w-56 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
              [(ngModel)]="inviteSelectedUserId"
              [disabled]="invitingMember"
            >
              <option value="">Оберіть користувача</option>
              @for (m of inviteFilteredMembers; track m.userId) {
                <option [value]="m.userId">{{ inviteOptionLabel(m) }}</option>
              }
            </select>

            @if (inviteSearch.trim() && inviteFilteredMembers.length === 0) {
              <p class="text-xs text-red-400">нічого не знайдено</p>
            }

            @if (invitePillMessage) {
              @if (invitePillKind === 'success') {
                <p class="inline-block rounded border border-emerald-800 bg-emerald-900/40 px-2 py-1 text-xs text-emerald-200">
                  {{ invitePillMessage }}
                </p>
              } @else {
                <p class="inline-block rounded border border-red-800 bg-red-900/40 px-2 py-1 text-xs text-red-200">
                  {{ invitePillMessage }}
                </p>
              }
            }
          </div>

          <button
            type="button"
            class="rounded bg-slate-700 px-3 py-1 text-white hover:bg-slate-600 disabled:opacity-50"
            [disabled]="invitingMember || !inviteSelectedUserId"
            (click)="inviteBoardMember()"
          >
            {{ invitingMember ? '…' : 'Запросити' }}
          </button>
        </div>
        <div cdkDropListGroup class="flex min-w-full flex-1 gap-4 overflow-x-auto pb-4">
          @for (col of boardStore.sortedColumns(); track col.id) {
            <app-column
              class="shrink-0"
              [column]="col"
              [canEdit]="boardStore.canEdit()"
              [creatingCard]="creatingCardColumnId === col.id"
              [showSkeleton]="skeletonColumnId === col.id && !!skeletonCardId"
              [skeletonCardId]="skeletonCardId"
              [skeletonTitle]="skeletonTitle"
              [skeletonStartDate]="skeletonStartDate"
              [skeletonEndDate]="skeletonEndDate"
              (addCard)="onAddCard(col.id)"
              (openCard)="openCard($event)"
              (skeletonTitleChange)="skeletonTitle = $event"
              (skeletonStartDateChange)="skeletonStartDate = $event"
              (skeletonEndDateChange)="skeletonEndDate = $event"
              (saveSkeleton)="saveSkeleton()"
              (cancelSkeleton)="cancelSkeleton()"
              (dropped)="onDrop($event, col.id)"
            />
          }
        </div>
      }
      <app-ai-assistant />
      <app-card-modal [card]="activeModalCard()" (close)="closeCardModal()" (save)="saveCardModal($event)" />
    </div>
  `,
})
export class BoardComponent implements OnDestroy {
  readonly boardStore = inject(BoardStore);
  readonly teamStore = inject(TeamStore);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BoardApiService);
  private readonly socket = inject(SocketService);
  private readonly toast = inject(ToastService);
  newColumnTitle = '';
  inviteSearch = '';
  inviteSelectedUserId = '';
  invitePillMessage: string | null = null;
  invitePillKind: 'success' | 'error' = 'success';
  invitingMember = false;
  creatingColumn = false;
  creatingCardColumnId: string | null = null;
  skeletonCardId: string | null = null;
  skeletonColumnId: string | null = null;
  skeletonTitle = '';
  skeletonStartDate = '';
  skeletonEndDate = '';
  selectedCardId: string | null = null;

  constructor() {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(),
        map((p) => p.get('boardId')),
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.socket.ensureConnected();
          this.socket.joinBoard(id);
          this.invitePillMessage = null;
          this.invitePillKind = 'success';
          this.resetInvite();
          return from(this.boardStore.loadBoard(id)).pipe(
            tap(() => {
              const b = this.boardStore.activeBoard();
              if (b?.teamId) {
                void this.teamStore.loadTeamDetail(b.teamId);
              }
            }),
          );
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.boardStore.setActiveBoard(null);
    this.teamStore.clearActiveTeam();
  }

  async inviteBoardMember(): Promise<void> {
    const board = this.boardStore.activeBoard();
    const userId = this.inviteSelectedUserId.trim();
    if (!board || !userId || this.invitingMember) {
      return;
    }

    const selectedMember = this.teamStore.activeTeam()?.members?.find((m) => m.userId === userId);
    const selectedLabel = selectedMember?.name || selectedMember?.email || selectedMember?.userId || userId;
    this.invitePillMessage = null;

    const meId = this.boardStore.user()?.id;
    if (meId && meId === userId) {
      // За бізнес-логікою (і щоб не отримати 4xx з бекенду) сам себе інвайтити не можна.
      this.toast.show('Неможливо запросити себе', 'error');
      return;
    }
    this.invitingMember = true;
    try {
      await firstValueFrom(this.api.inviteBoardMember(board.id, { userId }));
      this.invitePillKind = 'success';
      this.invitePillMessage = `Користувач ${selectedLabel} доданий до дошки`;
      this.toast.show('Запрошення надіслано', 'success');
      this.resetInvite();
      await this.teamStore.loadTeamDetail(board.teamId);
    } catch (e) {
      this.invitePillKind = 'error';
      const msg = e instanceof Error ? e.message : 'Не вдалося запросити';
      this.invitePillMessage = msg;
      this.toast.show(msg, 'error');
    } finally {
      this.invitingMember = false;
    }
  }

  private resetInvite(): void {
    this.inviteSearch = '';
    this.inviteSelectedUserId = '';
  }

  get inviteFilteredMembers(): TeamMember[] {
    const q = this.inviteSearch.trim().toLowerCase();
    const candidates = this.inviteCandidates();
    if (!q) {
      return candidates;
    }
    return candidates.filter((m) => this.matchesInviteQuery(m, q));
  }

  private inviteCandidates(): TeamMember[] {
    const team = this.teamStore.activeTeam();
    const members = team?.members ?? [];
    const meId = this.boardStore.user()?.id;
    const boardId = this.boardStore.activeBoard()?.id;

    const byId = new Map<string, TeamMember>();
    for (const m of members) {
      if (!m.userId) {
        continue;
      }
      if (meId && m.userId === meId) {
        continue;
      }

      // Backend-provided `member.boards` indicates which boards the user already has access to.
      // For the invite dropdown we show only those who do NOT yet have access to the active board.
      const hasAccessToActiveBoard = boardId ? m.boards?.some((b) => b.id === boardId) ?? false : false;
      if (hasAccessToActiveBoard) {
        continue;
      }

      byId.set(m.userId, m);
    }
    return [...byId.values()];
  }

  private matchesInviteQuery(member: TeamMember, normalizedQuery: string): boolean {
    if (!normalizedQuery) {
      return true;
    }
    const name = (member.name ?? '').trim().toLowerCase();
    const email = (member.email ?? '').trim().toLowerCase();
    return [name, email].some((v) => v.includes(normalizedQuery));
  }

  onInviteSearchChange(nextValue: string): void {
    const q = nextValue.trim().toLowerCase();
    if (nextValue.trim()) {
      this.invitePillMessage = null;
    }
    if (!this.inviteSelectedUserId) {
      return;
    }

    // Якщо вибір більше не входить у filtered list — очищаємо.
    const list = !q ? this.inviteCandidates() : this.inviteCandidates().filter((m) => this.matchesInviteQuery(m, q));
    if (!list.some((m) => m.userId === this.inviteSelectedUserId)) {
      this.inviteSelectedUserId = '';
    }
  }

  inviteOptionLabel(m: TeamMember): string {
    const base = m.name || m.email || m.userId;
    return `${base} (${m.userId})`;
  }

  async createColumn(): Promise<void> {
    if (!this.boardStore.canEdit() || this.creatingColumn) {
      return;
    }
    const board = this.boardStore.activeBoard();
    const title = this.newColumnTitle.trim();
    if (!board || !title) {
      return;
    }
    this.creatingColumn = true;
    this.boardStore.setError(null);
    try {
      await firstValueFrom(
        this.api.createColumn({
          title,
          boardId: board.id,
        }),
      );
      this.newColumnTitle = '';
      await this.boardStore.refreshActiveBoard();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to create column');
    } finally {
      this.creatingColumn = false;
    }
  }

  async onAddCard(columnId: string): Promise<void> {
    if (!this.boardStore.canEdit() || this.creatingCardColumnId) {
      return;
    }
    const board = this.boardStore.activeBoard();
    if (!board) {
      return;
    }
    const previous = structuredClone(board);
    this.creatingCardColumnId = columnId;
    this.boardStore.setError(null);
    try {
      const created = await firstValueFrom(
        this.api.createCard({
          columnId,
          title: 'New task',
          description: '',
        }),
      );
      await firstValueFrom(this.api.moveCard(created.id, { targetColumnId: columnId, newOrder: 0 }));
      await this.boardStore.refreshActiveBoard();
      this.skeletonCardId = created.id;
      this.skeletonColumnId = columnId;
      const card = this.findCard(created.id);
      this.skeletonTitle = card?.title ?? 'New task';
      this.skeletonStartDate = this.toDateInputValue(card?.deadline?.startDate);
      this.skeletonEndDate = this.toDateInputValue(card?.deadline?.endDate);
    } catch (e) {
      this.boardStore.setActiveBoard(previous);
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to create card');
    } finally {
      this.creatingCardColumnId = null;
    }
  }

  async saveSkeleton(): Promise<void> {
    if (!this.skeletonCardId || !this.skeletonTitle.trim()) {
      return;
    }
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(this.skeletonCardId, {
          title: this.skeletonTitle.trim(),
          deadline:
            this.skeletonStartDate || this.skeletonEndDate
              ? {
                  startDate: this.skeletonStartDate || undefined,
                  endDate: this.skeletonEndDate || undefined,
                }
              : undefined,
        }),
      );
      this.boardStore.upsertCard(updated);
      this.clearSkeleton();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to save card');
    }
  }

  async cancelSkeleton(): Promise<void> {
    if (!this.skeletonCardId) {
      return;
    }
    const id = this.skeletonCardId;
    this.clearSkeleton();
    try {
      await firstValueFrom(this.api.deleteCard(id));
      await this.boardStore.refreshActiveBoard();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to cancel card draft');
    }
  }

  async onDrop(event: CdkDragDrop<Card[]>, targetColumnId: string): Promise<void> {
    if (!this.boardStore.canEdit()) {
      return;
    }
    if (event.previousContainer === event.container && event.previousIndex === event.currentIndex) {
      return;
    }
    const card = event.previousContainer.data[event.previousIndex] as Card;
    const previous = structuredClone(this.boardStore.activeBoard()!);
    this.boardStore.applyOptimisticMove(card.id, targetColumnId, event.currentIndex);
    try {
      await firstValueFrom(
        this.api.moveCard(card.id, {
          targetColumnId,
          newOrder: event.currentIndex,
        }),
      );
    } catch {
      this.boardStore.setActiveBoard(previous);
    }
  }

  openCard(card: Card): void {
    if (this.skeletonCardId === card.id) {
      return;
    }
    this.selectedCardId = card.id;
  }

  closeCardModal(): void {
    this.selectedCardId = null;
  }

  async saveCardModal(payload: CardModalSavePayload): Promise<void> {
    const card = this.activeModalCard();
    if (!card) {
      return;
    }
    try {
      const updated = await firstValueFrom(
        this.api.patchCard(card.id, {
          title: payload.title,
          description: payload.description,
          priority: payload.priority,
          deadline: payload.deadline,
        }),
      );
      this.boardStore.upsertCard(updated);
      this.closeCardModal();
    } catch (e) {
      this.boardStore.setError(e instanceof Error ? e.message : 'Failed to update card');
    }
  }

  activeModalCard(): Card | null {
    if (!this.selectedCardId) {
      return null;
    }
    return this.findCard(this.selectedCardId);
  }

  private clearSkeleton(): void {
    this.skeletonCardId = null;
    this.skeletonColumnId = null;
    this.skeletonTitle = '';
    this.skeletonStartDate = '';
    this.skeletonEndDate = '';
  }

  private findCard(cardId: string): Card | null {
    for (const col of this.boardStore.sortedColumns()) {
      const found = col.cards.find((c) => c.id === cardId);
      if (found) {
        return found;
      }
    }
    return null;
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
