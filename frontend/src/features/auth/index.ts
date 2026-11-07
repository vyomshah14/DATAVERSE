/**
 * Authentication Feature Module (Day 2).
 */
export interface UserSession {
  userId: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
}
