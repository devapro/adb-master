import axios from 'axios';
import { useConnectionStore } from '../store/connection.store';
import { useCommandStore } from '../store/command.store';

const api = axios.create({
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const { mode, relayUrl, sessionId, password } = useConnectionStore.getState();

  if (mode === 'remote' && relayUrl) {
    config.baseURL = `${relayUrl}/api`;
    config.headers['x-relay-session'] = sessionId;
    if (password) {
      config.headers['x-relay-password'] = password;
    }
  } else {
    config.baseURL = '/api';
  }

  useCommandStore.getState().start();

  return config;
});

api.interceptors.response.use(
  (response) => {
    useCommandStore.getState().finish();
    return response;
  },
  (error) => {
    useCommandStore.getState().finish();
    const message = error.response?.data?.error || error.message || 'Unknown error';
    return Promise.reject(new Error(message));
  }
);

export default api;
