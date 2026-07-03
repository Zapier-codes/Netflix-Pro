// src/hooks/device/useDevice.ts
import { useState, useEffect } from 'react';
import { deviceManager, DeviceProfile } from '../../services/device/DeviceManager';

export const useDevice = () => {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const p = await deviceManager.initialize();
        setProfile(p);
      } catch (error) {
        console.error('[useDevice] Initialization error:', error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const p = await deviceManager.refresh();
      setProfile(p);
    } catch (error) {
      console.error('[useDevice] Refresh error:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    profile,
    loading,
    displayName: profile ? `${profile.emoji} ${profile.name || 'Guest'}` : '🌟 Guest',
    refresh,
  };
};