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

  function start() {
    onStatus('connecting');
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (stopped) return;
        onStatus('connected');
      };
      ws.onclose = () => {
        if (stopped) return;
        onStatus('disconnected');
        // reconnect
        setTimeout(() => start(), 1000);
      };
      ws.onerror = () => {
        if (stopped) return;
        onStatus('disconnected');
      };
      ws.onmessage = (msg) => {
        if (stopped) return;
        try {
          const data = JSON.parse(String(msg.data));
          if (data?.type === 'hello') return;
          onEvent(data);
        } catch {
          // ignore
        }
      };
    } catch {
      onStatus('disconnected');
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
