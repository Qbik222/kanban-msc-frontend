import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import { ToastService } from '../core/toast/toast.service';
import { BoardDetails, BoardSummary, Card, Column } from '../models/board.models';
import { BoardStore } from '../state/board.store';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private readonly auth = inject(AuthService);
  private readonly boardStore = inject(BoardStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  private socket: Socket | null = null;
  private listenersBound = false;

  ensureConnected(): void {
    if (this.socket?.connected) {
      return;
    }
    if (!this.socket) {
      const url =
        environment.apiUrl ||
        (typeof globalThis !== 'undefined' && 'location' in globalThis
          ? (globalThis as unknown as Window).location.origin
          : '');
      this.socket = io(url || 'http://localhost:4200', {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });
    }
    if (!this.listenersBound) {
      this.bindHandlers(this.socket);
      this.listenersBound = true;
    }
  }

  joinBoard(boardId: string): void {
    this.ensureConnected();
    const token = this.auth.getToken();
    if (!token || !this.socket) {
      return;
    }
    this.socket.emit('joinBoard', { boardId, token });
  }

  private bindHandlers(s: Socket): void {
    s.on('board:joined', () => undefined);

    s.on('board:join_error', (payload: { message?: string }) => {
      this.toast.show(payload?.message ?? 'Could not join board channel', 'error');
    });

    s.on('board:updated', (board: BoardSummary) => {
      this.boardStore.mergeBoardMetadata(board);
    });

    s.on('board:deleted', (board: BoardSummary) => {
      this.boardStore.removeBoardFromList(board.id);
      if (this.boardStore.activeBoard()?.id === board.id) {
        void this.router.navigateByUrl('/boards');
      }
    });

    s.on('columns:updated', (payload: { boardId: string; columns: Column[] }) => {
      this.boardStore.replaceColumns(payload.boardId, payload.columns);
    });

    s.on('card:created', (card: Card) => {
      this.boardStore.upsertCard(card);
    });

    s.on('card:updated', (card: Card) => {
      this.boardStore.upsertCard(card);
    });

    s.on('card:moved', (snapshot: BoardDetails) => {
      this.boardStore.setBoardFullSnapshot(snapshot);
    });

    s.on('comment:added', (card: Card) => {
      this.boardStore.upsertCard(card);
    });
  }
}
