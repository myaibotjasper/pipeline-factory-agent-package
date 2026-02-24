import http from 'node:http';
import express from 'express';
import cors from 'cors';

import { verifyGithubSignature } from './github/verifySignature.js';
import { normalizeGithubEvent } from './github/normalize.js';
import type { CanonicalEvent } from './github/normalize.js';
import { Store } from './state/store.js';
import { makeWsServer } from './ws/server.js';
import { ProgressStore } from './progress/progress.js';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

const PROGRESS_PATH = process.env.PROGRESS_PATH || './pipeline-progress.json';
const DEPLOY_SHA = process.env.DEPLOY_SHA || null;
const DEPLOYED_AT = process.env.DEPLOYED_AT || null;

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
const progress = new ProgressStore(PROGRESS_PATH);

let lastCi: { status: 'success' | 'failure' | 'unknown'; url: string | null; updatedAt: string | null } = {
  status: 'unknown',
  url: null,
  updatedAt: null,
};

function observe(ev: CanonicalEvent) {
  if (ev.type === 'CI_COMPLETED') {
    lastCi = {
      status: ev.status === 'success' ? 'success' : ev.status === 'failure' ? 'failure' : 'unknown',
      url: ev.entity.url ?? null,
      updatedAt: new Date(ev.ts).toISOString(),
    };
  }
}

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/state', (_req, res) => res.json(store.snapshot()));

// Machine-readable progress for the wallboard
app.get('/status', (_req, res) => {
  res.json(
    progress.getStatus({
      deploySha: DEPLOY_SHA,
      deployedAt: DEPLOYED_AT,
      ciStatus: lastCi.status,
      ciUrl: lastCi.url,
      ciUpdatedAt: lastCi.updatedAt,
    })
  );
});

app.get('/roadmap', (_req, res) => {
  res.json(progress.getRoadmap());
});

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
    observe(e);
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
