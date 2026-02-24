import http from 'node:http';
import { WebSocketServer } from 'ws';
import type { CanonicalEvent } from '../github/normalize.js';

export function makeWsServer(opts: {
  server: http.Server;
  onClientHello?: () => void;
}) {
  const wss = new WebSocketServer({ noServer: true });

  opts.server.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    if (!url.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    opts.onClientHello?.();
    ws.send(JSON.stringify({ type: 'hello', ts: Date.now() }));
  });

  function broadcast(ev: CanonicalEvent) {
    const msg = JSON.stringify(ev);
    for (const client of wss.clients) {
      // 1 == OPEN
      // @ts-ignore
      if (client.readyState === 1) client.send(msg);
    }
  }

  return { wss, broadcast };
}
