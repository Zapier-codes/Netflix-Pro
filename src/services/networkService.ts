// src/services/networkService.ts
import NetInfo from '@react-native-community/netinfo';
import { EventEmitter } from 'events';

export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
}

export class NetworkService extends EventEmitter {
  private static instance: NetworkService;
  private isConnected = false;
  private isWifi = false;
  private isCellular = false;
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const state = await NetInfo.fetch();
      this.updateState(state);
      this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange.bind(this));
      this.isInitialized = true;
      console.log('[Network] ✅ Initialized');
    } catch (error) {
      console.warn('[Network] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  private handleNetworkChange(state: any): void {
    this.updateState(state);
    this.emit(this.isConnected ? 'online' : 'offline');
  }

  private updateState(state: any): void {
    this.isConnected = state.isConnected ?? false;
    this.isWifi = state.type === 'wifi';
    this.isCellular = state.type === 'cellular';
  }

  isOnline(): boolean {
    return this.isConnected;
  }

  isOffline(): boolean {
    return !this.isConnected;
  }

  isOnWifi(): boolean {
    return this.isWifi && this.isConnected;
  }

  isOnCellular(): boolean {
    return this.isCellular && this.isConnected;
  }

  async waitForConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isConnected) return true;

    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.isConnected) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 1000);
    });
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
  }
}

export const networkService = NetworkService.getInstance();
