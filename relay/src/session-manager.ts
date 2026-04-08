import { v4 as uuidv4 } from 'uuid';
import type { Session, TunnelResponse } from './types';
import type { WebSocket } from 'ws';
import { config } from './config';

export class SessionManager {
  private sessions = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  createSession(password?: string): { sessionId: string; secret: string } {
    if (this.sessions.size >= config.maxSessions) {
      throw new Error('Maximum number of sessions reached');
    }

    const sessionId = uuidv4();
    const secret = uuidv4();

    const session: Session = {
      id: sessionId,
      secret,
      password: password || undefined,
      agentWs: null,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      pendingRequests: new Map(),
      clientSockets: new Map(),
    };

    this.sessions.set(sessionId, session);
    return { sessionId, secret };
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  validateAgent(sessionId: string, secret: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!session && session.secret === secret;
  }

  validateClient(sessionId: string, password?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (!session.password) return true;
    return session.password === password;
  }

  setAgentConnection(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.agentWs = ws;
    session.lastActivity = Date.now();
  }

  removeAgentConnection(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.agentWs = null;

    for (const [requestId, pending] of session.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Agent disconnected'));
    }
    session.pendingRequests.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > config.sessionTimeout) {
        console.log(`Cleaning up expired session: ${id}`);
        this.deleteSession(id);
      }
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.agentWs) {
      session.agentWs.close();
    }

    for (const [, pending] of session.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Session deleted'));
    }
    session.pendingRequests.clear();

    this.sessions.delete(sessionId);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    for (const [id] of this.sessions) {
      this.deleteSession(id);
    }
  }
}
