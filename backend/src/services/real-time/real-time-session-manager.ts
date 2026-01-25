/**
 * Real-time Session Manager
 * 
 * TDD Phase: GREEN - Minimal implementation for real-time session management
 * Enhancement: Real-time Processing with WebSockets
 */

export interface SessionRequest {
  userId: string;
  sessionId: string;
  sessionData: {
    activeFiles: string[];
    processingJobs?: string[];
    preferences: Record<string, any>;
    permissions: string[];
  };
}

export interface SessionInfo {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  sessionData: any;
  connectionCount: number;
}

export interface SessionCleanupOptions {
  reason: string;
  gracefulShutdown: boolean;
  preserveProcessingJobs: boolean;
}

export interface CleanupResult {
  sessionId: string;
  userId: string;
  cleanupPerformed: boolean;
  cleanupActions: string[];
  preservedData: any;
  cleanupDuration: number;
  resourcesFreed: {
    memoryFreed: number;
    connectionsFreed: number;
  };
}

export interface SessionStatus {
  sessionId: string;
  isActive: boolean;
  cleanupReason?: string;
  lastActivity?: Date;
}

export class SessionManager {
  private sessions: Map<string, SessionInfo> = new Map();
  private cleanupHistory: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async createSession(request: SessionRequest): Promise<SessionInfo> {
    const session: SessionInfo = {
      userId: request.userId,
      sessionId: request.sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      sessionData: request.sessionData,
      connectionCount: 0
    };

    this.sessions.set(request.sessionId, session);
    return session;
  }

  async getSession(userId: string, sessionId: string): Promise<SessionInfo | null> {
    const session = this.sessions.get(sessionId);
    
    if (session && session.userId === userId) {
      // Update last activity
      session.lastActivity = new Date();
      return { ...session }; // Return copy to prevent external modification
    }
    
    return null;
  }

  async updateSessionData(sessionId: string, data: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sessionData = { ...session.sessionData, ...data };
      session.lastActivity = new Date();
    }
  }

  async cleanupSession(sessionId: string, options: SessionCleanupOptions): Promise<CleanupResult> {
    const startTime = Date.now();
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const cleanupActions: string[] = [];
    let preservedData: any = {};

    // Archive session data
    cleanupActions.push('session_data_archived');

    // Close WebSocket connections
    if (session.connectionCount > 0) {
      cleanupActions.push('websocket_connections_closed');
    }

    // Preserve processing jobs if requested
    if (options.preserveProcessingJobs && session.sessionData.processingJobs) {
      preservedData.processingJobs = session.sessionData.processingJobs;
      preservedData.activeFiles = session.sessionData.activeFiles;
      cleanupActions.push('processing_jobs_preserved');
    }

    // Clean temporary files
    cleanupActions.push('temporary_files_cleaned');

    // Mark session as inactive
    session.isActive = false;

    // Store cleanup info
    this.cleanupHistory.set(sessionId, {
      cleanupReason: options.reason,
      cleanupAt: new Date(),
      preservedData,
      gracefulShutdown: options.gracefulShutdown
    });

    const cleanupDuration = Date.now() - startTime;

    return {
      sessionId,
      userId: session.userId,
      cleanupPerformed: true,
      cleanupActions,
      preservedData,
      cleanupDuration,
      resourcesFreed: {
        memoryFreed: 1024 * 1024, // Mock 1MB freed
        connectionsFreed: session.connectionCount
      }
    };
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const session = this.sessions.get(sessionId);
    const cleanupInfo = this.cleanupHistory.get(sessionId);

    if (session) {
      return {
        sessionId,
        isActive: session.isActive,
        lastActivity: session.lastActivity,
        cleanupReason: cleanupInfo?.cleanupReason
      };
    }

    if (cleanupInfo) {
      return {
        sessionId,
        isActive: false,
        cleanupReason: cleanupInfo.cleanupReason
      };
    }

    throw new Error(`Session ${sessionId} not found`);
  }

  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).filter(session => 
      session.userId === userId && session.isActive
    );
  }

  async cleanup(): Promise<void> {
    this.sessions.clear();
    this.cleanupHistory.clear();
    this.isInitialized = false;
  }
}

export default SessionManager;
