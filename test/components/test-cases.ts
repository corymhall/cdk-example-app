import { Post, Status } from '../../src/posts/types';

export const testCases: Post[] = [
  {
    author: 'corymhall',
    content: 'This is a test post',
    createdAt: new Date().toISOString(),
    pk: '1',
    status: Status.PUBLISHED,
    summary: 'Summary',
  },
];
