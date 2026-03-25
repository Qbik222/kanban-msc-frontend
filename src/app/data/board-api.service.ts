import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BoardDetails, BoardMemberDto, BoardMemberRole, BoardSummary, Card, CardDeadline } from '../models/board.models';

@Injectable({ providedIn: 'root' })
export class BoardApiService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  listBoards(): Observable<BoardSummary[]> {
    return this.http.get<BoardSummary[]>(`${this.api}/boards`);
  }

  getBoard(id: string): Observable<BoardDetails> {
    return this.http.get<BoardDetails>(`${this.api}/boards/${id}`);
  }

  createBoard(body: { title: string; teamId: string; projectIds?: string[] }): Observable<BoardSummary> {
    return this.http.post<BoardSummary>(`${this.api}/boards`, body);
  }

  inviteBoardMember(boardId: string, body: { userId: string }): Observable<unknown> {
    return this.http.post(`${this.api}/boards/${boardId}/members`, body);
  }

  listBoardMembers(boardId: string): Observable<BoardMemberDto[]> {
    return this.http.get<BoardMemberDto[]>(`${this.api}/boards/${boardId}/members`);
  }

  patchBoardMemberRole(
    boardId: string,
    memberUserId: string,
    body: { role: BoardMemberRole },
  ): Observable<unknown> {
    return this.http.patch(`${this.api}/boards/${boardId}/members/${memberUserId}/role`, body);
  }

  removeBoardMember(boardId: string, memberUserId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/boards/${boardId}/members/${memberUserId}`);
  }

  patchBoard(id: string, body: Partial<{ title: string; projectIds: string[] }>): Observable<BoardSummary> {
    return this.http.patch<BoardSummary>(`${this.api}/boards/${id}`, body);
  }

  deleteBoard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/boards/${id}`);
  }

  createColumn(body: { title: string; boardId: string }): Observable<unknown> {
    return this.http.post(`${this.api}/columns`, body);
  }

  reorderColumns(columns: { id: string; order: number }[]): Observable<unknown> {
    return this.http.patch(`${this.api}/columns/reorder`, { columns });
  }

  patchColumn(id: string, body: Partial<{ title: string }>): Observable<unknown> {
    return this.http.patch(`${this.api}/columns/${id}`, body);
  }

  deleteColumn(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/columns/${id}`);
  }

  createCard(body: {
    title: string;
    description: string;
    columnId: string;
    assigneeId?: string;
    projectIds?: string[];
    priority?: 'low' | 'medium' | 'high';
    deadline?: CardDeadline;
  }): Observable<Card> {
    return this.http.post<Card>(`${this.api}/cards`, body);
  }

  patchCard(
    id: string,
    body: Record<string, unknown> &
      Partial<{
        title: string;
        description: string;
        priority: 'low' | 'medium' | 'high';
        assigneeId: string;
        projectIds: string[];
        deadline: CardDeadline;
      }>,
  ): Observable<Card> {
    return this.http.patch<Card>(`${this.api}/cards/${id}`, body);
  }

  moveCard(id: string, body: { targetColumnId: string; newOrder: number }): Observable<Card> {
    return this.http.patch<Card>(`${this.api}/cards/${id}/move`, body);
  }

  deleteCard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/cards/${id}`);
  }

  addComment(cardId: string, body: { text: string }): Observable<Card> {
    return this.http.post<Card>(`${this.api}/cards/${cardId}/comments`, body);
  }

  deleteComment(cardId: string, commentId: string): Observable<Card> {
    return this.http.delete<Card>(`${this.api}/cards/${cardId}/comments/${commentId}`);
  }
}
