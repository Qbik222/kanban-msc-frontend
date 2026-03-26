import { Injectable, effect, inject } from '@angular/core';
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
  private activeBoardId: string | null = null;
  private joinedBoardId: string | null = null;
  private lastJoinToken: string | null = null;

  constructor() {
    effect(() => {
      const boardId = this.activeBoardId;
      const token = this.auth.getAccessToken();
      if (!boardId || !token) {
        return;
      }
      this.tryJoinActiveBoard(false);
    });
  }

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
    } else {
      // Socket instance exists but may be disconnected (e.g. after network drop).
      // Calling connect() is safe; socket.io will no-op if already connecting/connected.
      this.socket.connect();
    }
    if (!this.listenersBound) {
      this.bindHandlers(this.socket);
      this.listenersBound = true;
    }
  }

  joinBoard(boardId: string): void {
    this.activeBoardId = boardId;
    this.ensureConnected();
    // Actual join emit is handled by the token-driven effect to avoid races with /auth/refresh.
  }

  resetActiveBoard(): void {
    this.activeBoardId = null;
    this.joinedBoardId = null;
    this.lastJoinToken = null;
  }

  private tryJoinActiveBoard(force: boolean): void {
    const boardId = this.activeBoardId;
    if (!boardId) {
      return;
    }
    this.ensureConnected();
    const token = this.auth.getAccessToken();
    if (!token || !this.socket) {
      return;
    }
    if (!force && this.joinedBoardId === boardId && this.lastJoinToken === token) {
      return;
    }
    // Prevent bursts when token changes quickly (e.g. refresh + interceptor retries).
    if (!force && this.lastJoinToken === token && this.joinedBoardId !== boardId) {
      // Token is the same but server hasn't acknowledged join yet; avoid spamming.
      return;
    }
    this.lastJoinToken = token;
    this.socket.emit('joinBoard', { boardId, token });
  }

  private bindHandlers(s: Socket): void {
    s.on('connect', () => {
      // Re-join active board room after reconnect; rooms are not preserved across reconnects.
      this.joinedBoardId = null;
      this.tryJoinActiveBoard(true);
    });

    s.on('connect_error', () => {
      // Keep UI usable (REST still works), but this explains missing real-time sync.
      this.toast.show('Realtime connection failed. Changes may not sync.', 'error');
    });

    s.on('disconnect', () => {
      this.joinedBoardId = null;
    });

    s.on('board:joined', (payload: { boardId: string }) => {
      this.joinedBoardId = payload?.boardId ?? null;
    });

    s.on('board:join_error', (payload: { message?: string }) => {
      const message = payload?.message ?? 'Could not join board channel';
      if (message.toLowerCase().includes('unauthorized')) {
        this.auth.clearSession();
        void this.router.navigateByUrl('/login');
        return;
      }
      if (message.toLowerCase().includes('forbidden')) {
        // User is authenticated but lacks board:read; send them back to boards list.
        void this.router.navigateByUrl('/boards');
        this.toast.show('Access denied for this board.', 'error');
        return;
      }
      this.toast.show(message, 'error');
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
