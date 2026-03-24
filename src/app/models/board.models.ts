export interface CardComment {
  _id: string;
  text: string;
  authorId: string;
  createdAt?: string | Date;
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
  ownerId: string;
  projectIds: string[];
  isDeleted: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface BoardDetails extends BoardSummary {
  columns: Column[];
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
