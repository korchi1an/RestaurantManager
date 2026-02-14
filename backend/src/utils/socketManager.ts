import { Server } from 'socket.io';
import logger from './logger';

class SocketManager {
  private static instance: Server | null = null;
  private static initialized: boolean = false;

  static setIO(io: Server): void {
    SocketManager.instance = io;
    SocketManager.initialized = true;
    logger.info('SocketManager initialized successfully');
  }

  static getIO(): Server {
    if (!SocketManager.initialized || !SocketManager.instance) {
      logger.error('SocketManager.getIO() called before initialization', {
        initialized: SocketManager.initialized,
        hasInstance: SocketManager.instance !== null
      });
      throw new Error('Socket.IO instance not initialized. Call setIO first.');
    }
    return SocketManager.instance;
  }

  static isInitialized(): boolean {
    return SocketManager.initialized && SocketManager.instance !== null;
  }
}

export default SocketManager;
