// src/services/networkService.ts
import NetInfo from '@react-native-community/netinfo';

// Minimal dependency-free EventEmitter (Metro doesn't polyfill Node's
// 'events' module, and RN no longer exposes a global EventEmitter — so we
// implement the small subset this service actually needs).
class EventEmitter {
  private listeners: Record<string, Array<(...args: any[]) => void>> = {};

  on(event: string, listener: (...args: any[]) => void): this {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
    return this;
  }

  addListener(event: string, listener: (...args: any[]) => void): this {
    return this.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): this {
    this.listeners[event] = (this.listeners[event] || []).filter(l => l !== listener);
    return this;
  }

  removeListener(event: string, listener: (...args: any[]) => void): this {
    return this.off(event, listener);
  }

  once(event: string, listener: (...args: any[]) => void): this {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  emit(event: string, ...args: any[]): boolean {
    const eventListeners = this.listeners[event];
    if (!eventListeners || eventListeners.length === 0) return false;
    eventListeners.slice().forEach(listener => listener(...args));
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
    return this;
  }
}

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