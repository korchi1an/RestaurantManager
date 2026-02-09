import { io, Socket } from 'socket.io-client';
import { OrderWithItems } from '../types';

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;

  connect() {
    if (this.isConnected && this.socket?.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    // Get backend URL from environment variable (removes /api suffix for socket connection)
    const SOCKET_URL = (import.meta as any).env?.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    this.socket.on('connect', () => {
      console.log('Connected to Socket.IO server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from Socket.IO server');
      this.isConnected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  onOrderCreated(callback: (order: OrderWithItems) => void) {
    if (this.socket) {
      this.socket.on('orderCreated', callback);
    }
  }

  onOrderUpdated(callback: (order: OrderWithItems) => void) {
    if (this.socket) {
      this.socket.on('orderUpdated', callback);
    }
  }

  onOrderReady(callback: (order: OrderWithItems) => void) {
    if (this.socket) {
      this.socket.on('orderReady', callback);
    }
  }

  onOrderServed(callback: (order: OrderWithItems) => void) {
    if (this.socket) {
      this.socket.on('orderServed', callback);
    }
  }

  off(event: string) {
    if (this.socket) {
      this.socket.off(event);
    }
  }
}

export default new SocketService();
