// StatusBar - Connection status indicator (only visible when NOT connected)

import { useState, useEffect } from 'react';
import { ws } from '../services/websocket';

type ConnectionState = 'connected' | 'connecting' | 'disconnected';

export function StatusBar() {
  const [state, setState] = useState<ConnectionState>(
    ws.connected ? 'connected' : 'connecting'
  );

  useEffect(() => {
    const unsubConnected = ws.on('connected', () => {
      setState('connected');
    });

    const unsubAuth = ws.on('auth_success', () => {
      setState('connected');
    });

    const unsubFailed = ws.on('connection_failed', () => {
      setState('disconnected');
    });

    return () => {
      unsubConnected();
      unsubAuth();
      unsubFailed();
    };
  }, []);

  if (state === 'connected') {
    return null;
  }

  const isConnecting = state === 'connecting';

  return (
    <div
      className={`px-3 py-1.5 text-xs font-medium flex items-center gap-2 ${
        isConnecting ? 'bg-warning/20 text-warning' : 'bg-danger/20 text-danger'
      }`}
      role="status"
    >
      <span
        className={`w-2 h-2 rounded-full ${
          isConnecting ? 'bg-warning animate-pulse' : 'bg-danger'
        }`}
      />
      {isConnecting ? 'Connecting...' : 'Disconnected'}
    </div>
  );
}
