/**
 * Session Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make session management tests pass
 * Task: 2.4 - Concurrent User Handling
 * 
 * This class provides user session management with isolation and security.
 */

export interface UserSession {
  userId: string;
  sessionId: string;
  data: any;
  createdAt: Date;
  lastAccessed: Date;
  isActive: boolean;
}

export class SessionManager {
  private sessions: Map<string, UserSession> = new Map();
  private isInitialized: boolean = false;

  constructor() {}

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async createSession(userId: string, sessionId: string, data: any): Promise<UserSession> {
    const session: UserSession = {
      userId,
      sessionId,
      data,
      createdAt: new Date(),
      lastAccessed: new Date(),
      isActive: true
    };

    const sessionKey = `${userId}:${sessionId}`;
    this.sessions.set(sessionKey, session);
    
    return session;
  }

  async getSession(userId: string, sessionId: string): Promise<UserSession | null> {
    const sessionKey = `${userId}:${sessionId}`;
    const session = this.sessions.get(sessionKey);
    
    if (session) {
      session.lastAccessed = new Date();
      return { ...session };
    }
    
    return null;
  }

  async updateSessionData(userId: string, sessionId: string, data: any): Promise<void> {
    const sessionKey = `${userId}:${sessionId}`;
    const session = this.sessions.get(sessionKey);
    
    if (session) {
      session.data = data;
      session.lastAccessed = new Date();
    }
  }

  async cleanup(): Promise<void> {
    this.sessions.clear();
    this.isInitialized = false;
  }
}

export default SessionManager;
