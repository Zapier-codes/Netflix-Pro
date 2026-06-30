// src/services/NetworkMonitor.ts
import NetInfo from '@react-native-community/netinfo';
import { useAppStore } from '../store/zustand/store';

class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;
  private listeners: Set<(state: any) => void> = new Set();

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  async start() {
    if (this.isInitialized) return;

    try {
      const initialState = await NetInfo.fetch();
      this.updateState(initialState);

      this.unsubscribe = NetInfo.addEventListener((state) => {
        this.updateState(state);
      });

      this.isInitialized = true;
      console.log('[NetworkMonitor] ✅ Initialized');
    } catch (error) {
      console.warn('[NetworkMonitor] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  private updateState(state: any) {
    const isConnected = state.isConnected ?? false;
    const isWifi = state.type === 'wifi';
    const isCellular = state.type === 'cellular';
    const status = isConnected ? 'online' : 'offline';

    // Update Zustand store
    try {
      useAppStore.getState().setNetworkStatus(status);
    } catch (error) {
      // Store might not be initialized yet
    }

    this.notifyListeners({ isConnected, isWifi, isCellular, status, type: state.type });
  }

  getState() {
    return {
      isConnected: false,
      isWifi: false,
      isCellular: false,
      type: null,
      status: 'connecting' as const,
    };
  }

  isOnline() {
    // Get from Zustand store if available
    try {
      return useAppStore.getState().networkStatus === 'online';
    } catch {
      return false;
    }
  }

  isOnWifi() {
    // Implement if needed
    return false;
  }

  isOnCellular() {
    // Implement if needed
    return false;
  }

  canDownload(wifiOnlyEnabled: boolean = true) {
    const isOnline = this.isOnline();
    if (!isOnline) return false;
    if (wifiOnlyEnabled) {
      // Check if on WiFi
      return this.isOnWifi();
    }
    return true;
  }

  subscribe(callback: (state: any) => void) {
    this.listeners.add(callback);
    callback(this.getState());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(state: any) {
    this.listeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        // Ignore listener errors
      }
    });
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
  }

  async refresh() {
    try {
      const state = await NetInfo.fetch();
      this.updateState(state);
      return this.getState();
    } catch (error) {
      return this.getState();
    }
  }
}

const networkMonitor = NetworkMonitor.getInstance();
export default networkMonitor;
