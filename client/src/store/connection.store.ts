import { create } from 'zustand';

interface ConnectionState {
  mode: 'local' | 'remote';
  relayUrl: string;
  sessionId: string;
  password: string;
  connected: boolean;
  setRemote: (relayUrl: string, sessionId: string, password?: string) => void;
  setLocal: () => void;
  setConnected: (connected: boolean) => void;
}

function loadPersistedState(): Pick<ConnectionState, 'mode' | 'relayUrl' | 'sessionId' | 'password'> {
  try {
    const raw = localStorage.getItem('connection');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.mode === 'remote' && parsed.relayUrl && parsed.sessionId) {
        return {
          mode: 'remote',
          relayUrl: parsed.relayUrl,
          sessionId: parsed.sessionId,
          password: parsed.password || '',
        };
      }
    }
  } catch {
    // ignore
  }
  return { mode: 'local', relayUrl: '', sessionId: '', password: '' };
}

function persist(state: Pick<ConnectionState, 'mode' | 'relayUrl' | 'sessionId' | 'password'>) {
  localStorage.setItem('connection', JSON.stringify(state));
}

export const useConnectionStore = create<ConnectionState>((set) => {
  const initial = loadPersistedState();

  return {
    ...initial,
    connected: false,
    setRemote: (relayUrl, sessionId, password) => {
      const next = { mode: 'remote' as const, relayUrl, sessionId, password: password || '' };
      persist(next);
      set({ ...next, connected: false });
    },
    setLocal: () => {
      const next = { mode: 'local' as const, relayUrl: '', sessionId: '', password: '' };
      persist(next);
      set({ ...next, connected: false });
    },
    setConnected: (connected) => set({ connected }),
  };
});
