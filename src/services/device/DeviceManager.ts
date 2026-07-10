// src/services/device/DeviceManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import uuid from 'react-native-uuid';

const DEVICE_KEY = '@device_unique_key';
const DEVICE_PROFILE_KEY = '@device_profile';
const DEVICE_ALPHANUMERIC_ID_KEY = '@device_alphanumeric_id';

// ─────────────────────────────────────────────────────────────────────────────
// GEN Z NAME POOLS
// ─────────────────────────────────────────────────────────────────────────────

const EMOJIS = [
  '🔥', '⭐', '💫', '✨', '🌈', '🦋', '🌙', '☀️', '🌟', '💎', 
  '🎯', '🚀', '⚡', '💪', '👑', '🎮', '📱', '🎵', '🎶', '💜',
  '💙', '💚', '❤️', '🧡', '💛', '🖤', '🤍', '💗', '💖', '💝',
  '🌊', '🌺', '🌸', '🌹', '🌻', '🌷', '🌴', '🌵', '🌲', '🌳',
  '🍀', '🌿', '☘️', '🍃', '🍂', '🍁', '🍄', '🌾', '💐', '🌷'
];

const PREFIXES = [
  'Luna', 'Kai', 'Nova', 'Aura', 'Zen', 'Rex', 'Zara', 'Echo',
  'Neo', 'Maya', 'Jax', 'Rae', 'Finn', 'Theo', 'Leo', 'Aria',
  'Sage', 'Kira', 'Nyx', 'Onyx', 'Fox', 'Wolf', 'Phoenix', 'Raven',
  'Storm', 'Shadow', 'Crystal', 'Jade', 'Ruby', 'Sapphire', 'Emerald',
  'Cosmic', 'Lunar', 'Solar', 'Stellar', 'Nebula', 'Galaxy',
  'Quantum', 'Vortex', 'Eclipse', 'Apex', 'Vertex', 'Zenith',
  'Blaze', 'Frost', 'Ember', 'Ash', 'Sky', 'Ocean', 'Forest'
];

const SUFFIXES = [
  'Vibes', 'Wolf', 'Rider', 'Walker', 'Strike', 'Storm', 'Chaser',
  'Hunter', 'Gamer', 'Ninja', 'Knight', 'Wizard', 'Dragon', 'Titan',
  'Legend', 'Phantom', 'Shadow', 'Ghost', 'Spirit', 'Soul',
  'Dreamer', 'Creator', 'Seeker', 'Wanderer', 'Rising', 'Shining',
  'Crusher', 'Slayer', 'Beast', 'Warrior', 'Champion', 'Hero',
  'Zen', 'Flow', 'Wave', 'Surge', 'Pulse', 'Vibe', 'Glow'
];

const ADJECTIVES = [
  'Night', 'Day', 'Dark', 'Light', 'Wild', 'Free', 'Brave', 'Swift',
  'Loud', 'Quiet', 'Bold', 'Fierce', 'Gentle', 'Mighty', 'Noble',
  'Cosmic', 'Lunar', 'Solar', 'Stellar', 'Radiant', 'Eternal'
];

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE PROFILE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface DeviceProfile {
  id: string;                    // Unique alphanumeric ID
  name: string;                  // Generated Gen Z name
  emoji: string;                 // Assigned emoji
  avatar: string;                // Avatar representation
  deviceKey: string;             // Original device key (hashed)
  createdAt: string;
  lastActive: string;
  isAnonymous: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE MANAGER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class DeviceManager {
  private static instance: DeviceManager;
  private profile: DeviceProfile | null = null;

  static getInstance(): DeviceManager {
    if (!DeviceManager.instance) {
      DeviceManager.instance = new DeviceManager();
    }
    return DeviceManager.instance;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION - Creates or loads device profile
  // ─────────────────────────────────────────────────────────────────────────

  async initialize(): Promise<DeviceProfile> {
    if (this.profile) return this.profile;

    try {
      // Check if profile exists
      const existing = await AsyncStorage.getItem(DEVICE_PROFILE_KEY);
      if (existing) {
        this.profile = JSON.parse(existing);
        this.profile.lastActive = new Date().toISOString();
        await this.saveProfile(this.profile);
        return this.profile;
      }

      // Create new profile
      this.profile = await this.createNewProfile();
      await this.saveProfile(this.profile);
      return this.profile;
    } catch (error) {
      console.error('[DeviceManager] Initialization error:', error);
      this.profile = this.createEmergencyProfile();
      return this.profile;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE NEW PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  private async createNewProfile(): Promise<DeviceProfile> {
    // Step 1: Get or generate device key
    const deviceKey = await this.getDeviceKey();
    
    // Step 2: Generate unique alphanumeric ID from device key
    const alphanumericId = await this.generateAlphanumericId(deviceKey);
    
    // Step 3: Generate Gen Z name
    const { name, emoji } = this.generateGenZNameWithEmoji();
    
    // Step 4: Create profile
    return {
      id: alphanumericId,
      name: name,
      emoji: emoji,
      avatar: emoji,
      deviceKey: deviceKey,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isAnonymous: true
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DEVICE KEY MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────

  private async getDeviceKey(): Promise<string> {
    try {
      let deviceKey = await AsyncStorage.getItem(DEVICE_KEY);
      if (!deviceKey) {
        // Generate a unique device key using device info and UUID
        const deviceInfo = [
          Device.modelName || 'unknown',
          Device.deviceName || 'unknown',
          Platform.OS,
          Platform.Version,
          uuid.v4()
        ].join('|');
        
        // Hash the device info to create a consistent key
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          deviceInfo
        );
        deviceKey = hash;
        await AsyncStorage.setItem(DEVICE_KEY, deviceKey);
      }
      return deviceKey;
    } catch (error) {
      console.warn('[DeviceManager] Device key error:', error);
      return 'device-' + Date.now();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ALPHANUMERIC ID GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  private async generateAlphanumericId(deviceKey: string): Promise<string> {
    try {
      // Check if we already have an alphanumeric ID
      const existingId = await AsyncStorage.getItem(DEVICE_ALPHANUMERIC_ID_KEY);
      if (existingId) return existingId;

      // Take first 8 characters of the hash
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        deviceKey + 'salt'
      );
      
      // Convert to alphanumeric (A-Z, a-z, 0-9) - take first 12 chars
      const alphanumeric = this.hashToAlphanumeric(hash).substring(0, 12);
      
      await AsyncStorage.setItem(DEVICE_ALPHANUMERIC_ID_KEY, alphanumeric);
      return alphanumeric;
    } catch (error) {
      console.warn('[DeviceManager] Alphanumeric ID error:', error);
      return 'user-' + Date.now().toString(36);
    }
  }

  private hashToAlphanumeric(hash: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < hash.length; i += 2) {
      const hex = hash.substring(i, i + 2);
      const num = parseInt(hex, 16);
      result += chars[num % chars.length];
    }
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GEN Z NAME GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  private generateGenZNameWithEmoji(): { name: string; emoji: string } {
    const prefix = this.getRandomItem(PREFIXES);
    const suffix = this.getRandomItem(SUFFIXES);
    const adjective = this.getRandomItem(ADJECTIVES);
    const emoji = this.getRandomItem(EMOJIS);
    
    // Build name: Prefix + Suffix
    let name = prefix + suffix;
    
    // Ensure length is between 6-16 characters
    if (name.length < 6) {
      name = adjective + prefix;
    }
    if (name.length > 16) {
      name = name.substring(0, 16);
    }
    if (name.length < 6) {
      name = prefix + this.getRandomItem(PREFIXES).substring(0, 4);
    }

    return { name, emoji };
  }

  private getRandomItem<T>(array: T[]): T {
    // Use crypto for randomness
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
  }

  // ─────────────────────────────────────────────────────────────────────────
  // EMERGENCY PROFILE
  // ─────────────────────────────────────────────────────────────────────────

  private createEmergencyProfile(): DeviceProfile {
    return {
      id: 'emergency-' + Date.now().toString(36),
      name: 'GuestStar',
      emoji: '🌟',
      avatar: '🌟',
      deviceKey: 'emergency',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      isAnonymous: true
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAVE & REFRESH
  // ─────────────────────────────────────────────────────────────────────────

  private async saveProfile(profile: DeviceProfile): Promise<void> {
    await AsyncStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(profile));
  }

  async refresh(): Promise<DeviceProfile> {
    this.profile = null;
    return this.initialize();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GETTERS
  // ─────────────────────────────────────────────────────────────────────────

  getProfile(): DeviceProfile | null {
    return this.profile;
  }

  getDisplayName(): string {
    if (!this.profile) return '🌟Guest';
    return `${this.profile.emoji} ${this.profile.name}`;
  }

  getUserId(): string {
    return this.profile?.id || 'anonymous';
  }
}

export const deviceManager = DeviceManager.getInstance();