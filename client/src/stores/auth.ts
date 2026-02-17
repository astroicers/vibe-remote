// Auth Store

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '../services/api';
import { ws } from '../services/websocket';

interface AuthState {
  token: string | null;
  deviceId: string | null;
  deviceName: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  devQuickPair: (deviceName: string) => Promise<void>;
  checkAuth: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      deviceId: null,
      deviceName: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      devQuickPair: async (deviceName: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await auth.devQuickPair(deviceName);
          localStorage.setItem('auth_token', result.token);

          set({
            token: result.token,
            deviceId: result.deviceId,
            deviceName,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect WebSocket after auth
          ws.connect();
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const device = await auth.getMe();
          set({
            token,
            deviceId: device.id,
            deviceName: device.name,
            isAuthenticated: true,
            isLoading: false,
          });

          // Connect WebSocket
          ws.connect();
        } catch {
          // Token invalid, clear it
          localStorage.removeItem('auth_token');
          set({
            token: null,
            deviceId: null,
            deviceName: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token');
        ws.disconnect();
        set({
          token: null,
          deviceId: null,
          deviceName: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'vibe-remote-auth',
      partialize: (state) => ({
        token: state.token,
        deviceId: state.deviceId,
        deviceName: state.deviceName,
      }),
    }
  )
);
