import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { db } from '../lib/db';
import { pullFromCloud, setSyncCallback, triggerSync, fullSync } from '../lib/sync';
import type { Profile } from '../lib/types';

export type PageName = 'home' | 'study' | 'planner' | 'finance' | 'diary' | 'settings';

const DEVICE_TRUST_KEY = 'yours_device_trusted_profile';

function isDeviceTrusted(profileId: string): boolean {
  try {
    return localStorage.getItem(DEVICE_TRUST_KEY) === profileId;
  } catch {
    return false;
  }
}

function markDeviceTrusted(profileId: string) {
  try {
    localStorage.setItem(DEVICE_TRUST_KEY, profileId);
  } catch {
    /* ignore */
  }
}

/** New device (or cleared storage) must enter PIN if one is stored — even when pin_enabled is off */
function shouldLockOnBoot(profile: Profile, isFirstPaint: boolean): boolean {
  if (!isFirstPaint) return false; // never re-lock mid-session via refreshProfile
  const hasPin = typeof profile.pin === 'string' && profile.pin.length === 4;
  if (!hasPin) return false;

  // Known device: respect settings toggle
  if (isDeviceTrusted(profile.id)) {
    return !!profile.pin_enabled;
  }

  // New / untrusted device: always require PIN when one exists
  return true;
}

interface AppContextType {
  profile: Profile | null;
  loading: boolean;
  locked: boolean;
  needsSetup: boolean;
  online: boolean;
  syncStatus: string;
  activePage: PageName;
  refreshKey: number;
  setActivePage: (p: PageName) => void;
  setLocked: (v: boolean) => void;
  unlockAndSync: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAll: () => void;
  completeSetup: (profile: Profile) => void;
  forceSync: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [activePage, setActivePage] = useState<PageName>('home');
  const [refreshKey, setRefreshKey] = useState(0);
  const hasInitialized = useRef(false);
  const bootLockApplied = useRef(false);

  const applyProfileState = useCallback((profiles: Profile[], opts?: { fromBoot?: boolean }) => {
    if (profiles.length > 0) {
      const sorted = [...profiles].sort((a, b) =>
        String(b.updated_at || '').localeCompare(String(a.updated_at || ''))
      );
      const p = sorted[0];
      setProfile(p);
      setNeedsSetup(false);

      // Lock decision only on first successful profile load this session
      if (!bootLockApplied.current) {
        setLocked(shouldLockOnBoot(p, true));
        bootLockApplied.current = true;
      }
    } else {
      setProfile(null);
      setNeedsSetup(true);
      setLocked(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profiles = await db.profile.toArray();
    applyProfileState(profiles);
  }, [applyProfileState]);

  const refreshAll = useCallback(() => {
    setRefreshKey(k => k + 1);
    refreshProfile();
  }, [refreshProfile]);

  const completeSetup = useCallback((p: Profile) => {
    setProfile(p);
    setNeedsSetup(false);
    // First-time setup on this device — trust after setup; lock only if they enabled PIN
    markDeviceTrusted(p.id);
    bootLockApplied.current = true;
    setLocked(!!p.pin_enabled && typeof p.pin === 'string' && p.pin.length === 4);
  }, []);

  /** Successful PIN unlock — trust this device, unlock, then sync */
  const unlockAndSync = useCallback(async () => {
    setLocked(false);
    const profiles = await db.profile.toArray();
    if (profiles[0]?.id) {
      markDeviceTrusted(profiles[0].id);
    }
    if (navigator.onLine) {
      try {
        await fullSync();
        await refreshProfile();
        setRefreshKey(k => k + 1);
      } catch (e) {
        console.error('[app] unlock sync failed:', e);
      }
    }
  }, [refreshProfile]);

  const forceSync = useCallback(async () => {
    if (!navigator.onLine) return;
    await fullSync();
    await refreshProfile();
    setRefreshKey(k => k + 1);
  }, [refreshProfile]);

  useEffect(() => {
    setSyncCallback(setSyncStatus);

    (async () => {
      try {
        // 1) Local profile first
        let profiles = await db.profile.toArray();

        // 2) New device: empty local DB → pull cloud BEFORE deciding setup
        if (profiles.length === 0 && navigator.onLine) {
          onSyncStatusChangeSafe('syncing');
          try {
            await pullFromCloud();
            profiles = await db.profile.toArray();
          } catch (e) {
            console.error('[app] restore-from-cloud failed:', e);
          }
        }

        // 3) Apply profile / setup / lock
        applyProfileState(profiles, { fromBoot: true });
        hasInitialized.current = true;
        setLoading(false);

        // 4) Background full sync if we already had local data
        if (navigator.onLine && profiles.length > 0) {
          try {
            await pullFromCloud();
            const again = await db.profile.toArray();
            applyProfileState(again);
            setRefreshKey(k => k + 1);
            triggerSync();
          } catch (e) {
            console.error('[app] background pull failed:', e);
          }
        }
      } catch (e) {
        console.error('[app] boot failed:', e);
        hasInitialized.current = true;
        setLoading(false);
        setNeedsSetup(true);
        setLocked(false);
      }
    })();

    const onOnline = () => {
      setOnline(true);
      fullSync().then(async () => {
        const profiles = await db.profile.toArray();
        applyProfileState(profiles);
        setRefreshKey(k => k + 1);
      });
    };
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        fullSync().then(async () => {
          const profiles = await db.profile.toArray();
          applyProfileState(profiles);
          setRefreshKey(k => k + 1);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [applyProfileState]);

  return (
    <AppContext.Provider value={{
      profile, loading, locked, needsSetup, online, syncStatus,
      activePage, refreshKey, setActivePage, setLocked, unlockAndSync,
      refreshProfile, refreshAll, completeSetup, forceSync,
    }}>
      {children}
    </AppContext.Provider>
  );
}

function onSyncStatusChangeSafe(_s: string) {
  /* status is set via setSyncCallback once provider mounts */
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
