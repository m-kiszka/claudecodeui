import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '@/modules/auth';
import { api, readApiErrorMessage } from '@/shared/api';
import { useWebSocket } from '@/shared/context/WebSocketContext';
import type { Plugin } from '@/shared/types';
import { IS_PLATFORM } from '@/shared/utils';

const MAX_FETCH_RETRIES = 5;


type PluginsContextValue = {
  plugins: Plugin[];
  loading: boolean;
  pluginsError: string | null;
  refreshPlugins: () => Promise<void>;
  installPlugin: (url: string) => Promise<{ success: boolean; error?: string }>;
  uninstallPlugin: (name: string) => Promise<{ success: boolean; error?: string }>;
  updatePlugin: (name: string) => Promise<{ success: boolean; error?: string }>;
  togglePlugin: (name: string, enabled: boolean) => Promise<{ success: boolean; error: string | null }>;
};

const PluginsContext = createContext<PluginsContextValue | null>(null);

export function usePlugins() {
  const context = useContext(PluginsContext);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginsProvider');
  }
  return context;
}

/** Mounted by the app root so the plugins and project-workspace modules can read and mutate installed plugins through usePlugins. */
export function PluginsProvider({ children }: { children: ReactNode }) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [pluginsError, setPluginsError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { isLoading: isAuthLoading, user } = useAuth();
  const { subscribe } = useWebSocket();

  const refreshPlugins = useCallback(async () => {
    try {
      const res = await api.plugins.list();
      if (res.ok) {
        const data = await res.json();
        setPlugins(data.plugins || []);
        setPluginsError(null);
        setRetryCount(0);
      } else {
        let errorMessage = `Failed to fetch plugins (${res.status})`;
        try {
          const data = await res.json();
          errorMessage = readApiErrorMessage(data) ?? errorMessage;
        } catch {
          errorMessage = res.statusText || errorMessage;
        }
        setPluginsError(errorMessage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch plugins';
      setPluginsError(message);
      console.error('[Plugins] Failed to fetch plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // This provider mounts outside ProtectedRoute, so the first fetch can run
  // before login and fail with 401. Refetch once the user is authenticated.
  useEffect(() => {
    if (!IS_PLATFORM && (isAuthLoading || !user)) return;
    void refreshPlugins();
  }, [refreshPlugins, isAuthLoading, user]);

  // A transient failure (server still booting, network blip) would otherwise
  // leave plugin tabs missing until a full page reload.
  useEffect(() => {
    if (!pluginsError || retryCount >= MAX_FETCH_RETRIES) return undefined;
    const timer = setTimeout(() => {
      setRetryCount((count) => count + 1);
      void refreshPlugins();
    }, 2000 * 2 ** retryCount);
    return () => clearTimeout(timer);
  }, [pluginsError, retryCount, refreshPlugins]);

  useEffect(() => subscribe((event) => {
    if (event.kind === 'websocket_reconnected') {
      setRetryCount(0);
      void refreshPlugins();
    }
  }), [subscribe, refreshPlugins]);

  const installPlugin = useCallback(async (url: string) => {
    try {
      const res = await api.plugins.install(url);
      const data = await res.json();
      if (res.ok) {
        await refreshPlugins();
        return { success: true };
      }
      return { success: false, error: readApiErrorMessage(data) ?? 'Install failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Install failed' };
    }
  }, [refreshPlugins]);

  const uninstallPlugin = useCallback(async (name: string) => {
    try {
      const res = await api.plugins.uninstall(name);
      const data = await res.json();
      if (res.ok) {
        await refreshPlugins();
        return { success: true };
      }
      return { success: false, error: readApiErrorMessage(data) ?? 'Uninstall failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Uninstall failed' };
    }
  }, [refreshPlugins]);

  const updatePlugin = useCallback(async (name: string) => {
    try {
      const res = await api.plugins.update(name);
      const data = await res.json();
      if (res.ok) {
        await refreshPlugins();
        return { success: true };
      }
      return { success: false, error: readApiErrorMessage(data) ?? 'Update failed' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Update failed' };
    }
  }, [refreshPlugins]);

  const togglePlugin = useCallback(async (name: string, enabled: boolean): Promise<{ success: boolean; error: string | null }> => {
    try {
      const res = await api.plugins.toggle(name, enabled);
      if (!res.ok) {
        let errorMessage = `Toggle failed (${res.status})`;
        try {
          const data = await res.json();
          errorMessage = readApiErrorMessage(data) ?? errorMessage;
        } catch {
          // response body wasn't JSON, use status text
          errorMessage = res.statusText || errorMessage;
        }
        return { success: false, error: errorMessage };
      }
      await refreshPlugins();
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Toggle failed' };
    }
  }, [refreshPlugins]);

  // Built once per change: an inline object would re-render every consumer on
  // any render of this provider.
  const value = useMemo(
    () => ({ plugins, loading, pluginsError, refreshPlugins, installPlugin, uninstallPlugin, updatePlugin, togglePlugin }),
    [installPlugin, loading, plugins, pluginsError, refreshPlugins, togglePlugin, uninstallPlugin, updatePlugin],
  );

  return (
    <PluginsContext.Provider value={value}>
      {children}
    </PluginsContext.Provider>
  );
}
