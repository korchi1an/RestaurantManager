import { Server } from 'socket.io';

class SocketManager {
  private static instance: Server | null = null;

  static setIO(io: Server): void {
    SocketManager.instance = io;
  }

  static getIO(): Server {
    if (!SocketManager.instance) {
      throw new Error('Socket.IO instance not initialized. Call setIO first.');
    }
    return SocketManager.instance;
  }
}

export default SocketManager;
