export type CanonicalEvent = {
  id: string;
  ts: number;
  source: 'github' | string;
  org: string;
  repo: string;
  type: string;
  status: 'info' | 'success' | 'failure' | 'warning';
  station_hint?: string;
  entity: { kind: string; key: string; title?: string; url?: string };
  meta?: Record<string, unknown>;
};

export function connectEventStream(opts: {
  wsUrl: string;
  onStatus: (s: 'connecting' | 'connected' | 'disconnected') => void;
  onEvent: (e: CanonicalEvent) => void;
}) {
  const { wsUrl, onStatus, onEvent } = opts;
  let ws: WebSocket | null = null;
  let stopped = false;
  let attempt = 0;

  function nextDelayMs() {
    // 0.5s → 8s exponential with jitter
    const base = Math.min(8000, 500 * Math.pow(2, attempt));
    const jitter = base * (0.2 * Math.random());
    return Math.round(base + jitter);
  }

  function start() {
    onStatus('connecting');
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (stopped) return;
        attempt = 0;
        onStatus('connected');
      };
      ws.onclose = () => {
        if (stopped) return;
        onStatus('disconnected');
        attempt += 1;
        setTimeout(() => start(), nextDelayMs());
      };
      ws.onerror = () => {
        if (stopped) return;
        onStatus('disconnected');
        try {
          ws?.close();
        } catch {}
      };
      ws.onmessage = (msg) => {
        if (stopped) return;
        try {
          const data = JSON.parse(String(msg.data));
          if (data?.type === 'hello') return;
          // minimal shape validation
          if (!data || typeof data !== 'object') return;
          if (typeof data.type !== 'string' || typeof data.ts !== 'number') return;
          onEvent(data);
        } catch {
          // ignore
        }
      };
    } catch {
      onStatus('disconnected');
      attempt += 1;
      setTimeout(() => start(), nextDelayMs());
    }
  }

  start();

  return {
    stop() {
      stopped = true;
      try {
        ws?.close();
      } catch {}
      ws = null;
    },
  };
}
