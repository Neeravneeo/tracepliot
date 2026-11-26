import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../api';

type AppContextType = {
  incidents: any[];
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  toast: string | null;
  newIncidentIds: Set<string>;
  retry: () => void;
  user: any | null;
  token: string | null;
  authPaused: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
};

const AppContext = createContext<AppContextType>({
  incidents: [],
  loading: true,
  error: null,
  lastSynced: null,
  toast: null,
  newIncidentIds: new Set(),
  retry: () => {},
  user: null,
  token: null,
  authPaused: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  currentProjectId: null,
  setCurrentProjectId: () => {}
});

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const isViteAuthPaused = import.meta.env.VITE_PAUSE_AUTH === 'true';
  const devUser = { id: 'dev_testing_user', email: 'developer@tracepilot.dev' };

  const [authPaused, setAuthPaused] = useState<boolean>(isViteAuthPaused);
  const [user, setUser] = useState<any | null>(() => {
    return isViteAuthPaused ? devUser : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('tracepilot_token') || (isViteAuthPaused ? 'dev_testing_token' : null);
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return localStorage.getItem('tracepilot_project_id') || (isViteAuthPaused ? 'proj_dev_testing' : null);
  });

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [newIncidentIds, setNewIncidentIds] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);

  // Check whether authentication is paused on backend for testing
  useEffect(() => {
    let isMounted = true;
    fetchApi('/auth/status')
      .then(res => {
        if (!isMounted) return;
        if (res && res.authPaused) {
          setAuthPaused(true);
          setUser((u: any) => u || devUser);
          setToken((t: any) => {
            if (!t) {
              localStorage.setItem('tracepilot_token', 'dev_testing_token');
              return 'dev_testing_token';
            }
            return t;
          });
        }
      })
      .catch(() => {
        if (isViteAuthPaused && isMounted) {
          setAuthPaused(true);
          setUser(devUser);
          setToken('dev_testing_token');
        }
      });
    return () => { isMounted = false; };
  }, [isViteAuthPaused]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setRetryCount(c => c + 1);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    localStorage.setItem('tracepilot_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setRetryCount(c => c + 1);
  };

  const register = async (email: string, pass: string) => {
    const res = await fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass })
    });
    localStorage.setItem('tracepilot_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setRetryCount(c => c + 1);
  };

  const logout = () => {
    localStorage.removeItem('tracepilot_token');
    localStorage.removeItem('tracepilot_project_id');
    setToken(null);
    setUser(null);
    setCurrentProjectId(null);
    setIncidents([]);
  };

  useEffect(() => {
    if (currentProjectId) {
      localStorage.setItem('tracepilot_project_id', currentProjectId);
    } else {
      localStorage.removeItem('tracepilot_project_id');
    }
  }, [currentProjectId]);

  useEffect(() => {
    let isMounted = true;
    let initialLoadDone = false;
    let knownIds = new Set<string>();

    const loadData = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const query = currentProjectId ? `?projectId=${currentProjectId}&limit=100` : `?limit=100`;
        const resp = await fetchApi(`/incidents${query}`);
        if (!isMounted) return;
        
        const incs = resp.data || [];
        setIncidents(incs);
        setLastSynced(new Date());
        setError(null); // Clear error on successful fetch

        if (initialLoadDone) {
          const currentIds = new Set<string>(incs.map((i: any) => String(i.id)));
          const newIds = new Set<string>();
          let hasNew = false;
          
          for (const id of Array.from(currentIds)) {
            if (!knownIds.has(id)) {
              newIds.add(id);
              hasNew = true;
            }
          }

          if (hasNew) {
            setNewIncidentIds(newIds);
            const latestNew = incs.find((i:any) => newIds.has(String(i.id)));
            if (latestNew) {
              setToast(`New incident detected: ${latestNew.exceptionType}`);
              setTimeout(() => setToast(null), 4000);
              setTimeout(() => setNewIncidentIds(new Set()), 5000); // Clear highlight
            }
          }
          knownIds = currentIds;
        } else {
          knownIds = new Set<string>(incs.map((i: any) => String(i.id)));
          initialLoadDone = true;
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Failed to load incidents", err);
        if (err.message?.includes('Unauthorized') && !authPaused && !isViteAuthPaused) {
          logout();
        } else {
          setError(err.message || 'Unable to connect to TracePilot API');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [retryCount]);

  return (
    <AppContext.Provider value={{ 
      incidents, loading, error, lastSynced, toast, newIncidentIds, retry,
      user, token, authPaused, login, register, logout, currentProjectId, setCurrentProjectId 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);