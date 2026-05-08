/**
 * Custom Next.js server with a WebSocket endpoint at /ws.
 * Run with `pnpm dev` (tsx watch) or `pnpm start`.
 */
import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { GameWsServer } from './src/server/ws-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const gameWs = new GameWsServer();

void app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const url = req.url ? parse(req.url, true) : undefined;
    handle(req, res, url);
  });

  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ? parse(req.url) : undefined;
    if (url?.pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        gameWs.handleConnection(ws);
      });
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket at ws://${hostname}:${port}/ws`);
  });
});
