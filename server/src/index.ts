// Clear CLAUDECODE env var to allow nested Claude Code sessions
// This is needed when the server runs inside a Claude Code VS Code extension session
// The SDK's CLI will refuse to start if CLAUDECODE is set
delete process.env.CLAUDECODE;

import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDb, closeDb } from './db/index.js';
import routes from './routes/index.js';
import { handleChatWebSocket } from './ws/index.js';
import { getWatcher } from './workspace/watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
initDb();

// Create Express app with WebSocket support
const { app, getWss } = expressWs(express());

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  });
});

// API routes
app.use('/api', routes);

// WebSocket endpoint for chat
app.ws('/ws', (ws, _req) => {
  console.log('🔌 WebSocket client connected');

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString(),
      message: 'Welcome to Vibe Remote',
    })
  );

  // Handle chat WebSocket
  handleChatWebSocket(ws);

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Serve static files in production
if (config.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(config.NODE_ENV === 'development' && { details: err.message }),
  });
});

// Start server
const server = app.listen(config.PORT, config.HOST, () => {
  console.log(`
🚀 Vibe Remote Server
────────────────────────
📡 HTTP:  http://${config.HOST}:${config.PORT}
🔌 WS:    ws://${config.HOST}:${config.PORT}/ws
🌍 Env:   ${config.NODE_ENV}
────────────────────────
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  getWatcher().unwatchAll();
  server.close(() => {
    closeDb();
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down...');
  getWatcher().unwatchAll();
  server.close(() => {
    closeDb();
    console.log('👋 Server closed');
    process.exit(0);
  });
});

export { app, getWss };
