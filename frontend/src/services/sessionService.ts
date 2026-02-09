import { v4 as uuidv4 } from 'uuid';

// Get API base URL from environment
const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface SessionData {
  sessionId: string;
  tableNumber: number;
  createdAt: string;
}

class SessionService {
  private deviceId: string;

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
  }

  private getOrCreateDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  getStoredSession(): SessionData | null {
    const sessionData = sessionStorage.getItem('currentSession');
    if (sessionData) {
      try {
        return JSON.parse(sessionData);
      } catch {
        return null;
      }
    }
    return null;
  }

  async createSession(tableNumber: number): Promise<SessionData> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber,
        deviceId: this.deviceId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create session');
    }

    const data = await response.json();
    const sessionData: SessionData = {
      sessionId: data.sessionId,
      tableNumber: data.tableNumber,
      createdAt: data.createdAt
    };

    sessionStorage.setItem('currentSession', JSON.stringify(sessionData));
    return sessionData;
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      sessionStorage.removeItem('currentSession');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  async heartbeat(sessionId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/sessions/${sessionId}/heartbeat`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error sending heartbeat:', error);
    }
  }

  clearStoredSession(): void {
    sessionStorage.removeItem('currentSession');
  }
}

export default new SessionService();
