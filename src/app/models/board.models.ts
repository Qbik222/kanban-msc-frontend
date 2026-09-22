export interface CommentAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface CardComment {
  _id: string;
  text: string;
  authorId: string;
  createdAt?: string | Date;
  author?: CommentAuthor;
  parentCommentId?: string | null;
}

export type CardActivityType = 'deadline_changed' | 'assignee_changed' | 'description_changed' | 'priority_changed';

export interface CardActivityItem {
  _id: string;
  type: CardActivityType;
  actorId: string;
  createdAt?: string | Date;
  description?: {
    from?: string | null;
    to?: string | null;
  };
  priority?: {
    from?: 'low' | 'medium' | 'high' | null;
    to?: 'low' | 'medium' | 'high' | null;
  };
  assignee?: {
    fromUserId?: string | null;
    toUserId?: string | null;
  };
  deadline?: {
    from?: { startDate?: string | Date; endDate?: string | Date } | null;
    to?: { startDate?: string | Date; endDate?: string | Date } | null;
  };
}

export interface CardActivityResponse {
  cardId: string;
  items: CardActivityItem[];
}

export interface CardDeadline {
  startDate?: string | Date;
  endDate?: string | Date;
}

export interface Card {
  id: string;
  title: string;
  order: number;
  description: string;
  columnId: string;
  boardId: string;
  isDeleted: boolean;
  taskComplete: boolean;
  assigneeId?: string;
  deadline?: CardDeadline;
  projectIds: string[];
  priority?: 'low' | 'medium' | 'high';
  comments: CardComment[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  boardId: string;
  isDeleted: boolean;
  cards: Card[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BoardSummary {
  id: string;
  title: string;
  teamId: string;
  ownerId: string;
  projectIds: string[];
  isDeleted: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BoardDetails extends BoardSummary {
  columns: Column[];
}

export type BoardMemberRole = 'owner' | 'editor' | 'viewer';

export interface BoardMemberDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: BoardMemberRole;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
