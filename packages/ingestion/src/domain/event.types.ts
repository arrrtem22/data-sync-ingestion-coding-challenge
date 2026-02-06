export interface IngestedEvent {
  id: string;
  [key: string]: any;
}

export interface EventBatch {
  events: IngestedEvent[];
  cursor: string | null;
  hasMore: boolean;
}

export interface StreamAccess {
  token: string;
  endpoint: string;
  expiresIn: number;
  fetchedAt: number;
}
