export enum Status {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
}
export interface Post {
  readonly pk: string;
  readonly author: string;
  readonly summary: string;
  readonly content: string;
  readonly status: Status;
  readonly createdAt: string;
  readonly categories?: string[];
  readonly comments?: number;
}
