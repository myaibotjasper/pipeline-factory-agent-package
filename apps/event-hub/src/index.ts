import http from 'node:http';
import express from 'express';
import cors from 'cors';

import { verifyGithubSignature } from './github/verifySignature.js';
import { normalizeGithubEvent } from './github/normalize.js';
import { Store } from './state/store.js';
import { makeWsServer } from './ws/server.js';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

const app = express();
app.use(cors());

// raw body capture for signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const store = new Store(300);

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/state', (_req, res) => res.json(store.snapshot()));

app.post('/webhooks/github', (req: any, res) => {
  const sig = req.header('X-Hub-Signature-256');
  const rawBody: Buffer = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!verifyGithubSignature({ secret: SECRET, signatureHeader: sig, rawBody })) {
    res.status(401).json({ ok: false });
    return;
  }

  const evt = req.header('X-GitHub-Event') || 'unknown';
  const events = normalizeGithubEvent(evt, req.body);
  for (const e of events) {
    store.push(e);
    ws.broadcast(e);
  }

  res.json({ ok: true, count: events.length });
});

const server = http.createServer(app);
const ws = makeWsServer({ server });

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[event-hub] listening on http://${HOST}:${PORT}`);
});
