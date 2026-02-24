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
  let reconnectTimer: number | null = null;

  function clearReconnectTimer() {
    if (reconnectTimer == null) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function nextDelayMs() {
    // 0.5s → 8s exponential with jitter
    const base = Math.min(8000, 500 * Math.pow(2, attempt));
    const jitter = base * (0.2 * Math.random());
    return Math.round(base + jitter);
  }

  function scheduleReconnect() {
    if (stopped) return;
    clearReconnectTimer();

    // if the device is offline, don't hammer reconnect; wait for 'online'
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      onStatus('disconnected');
      return;
    }

    attempt += 1;
    reconnectTimer = window.setTimeout(() => start(), nextDelayMs());
  }

  function start() {
    if (stopped) return;
    clearReconnectTimer();

    // hard reset old socket if any
    try {
      ws?.close();
    } catch {}
    ws = null;

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
        scheduleReconnect();
      };

      ws.onerror = () => {
        if (stopped) return;
        onStatus('disconnected');
        try {
          ws?.close();
        } catch {}
        scheduleReconnect();
      };

      ws.onmessage = (msg) => {
        if (stopped) return;
        try {
          const data = JSON.parse(String(msg.data));
          if (data?.type === 'hello') return;
          // minimal shape validation
          if (!data || typeof data !== 'object') return;
          if (typeof (data as any).type !== 'string' || typeof (data as any).ts !== 'number') return;
          onEvent(data as CanonicalEvent);
        } catch {
          // ignore
        }
      };
    } catch {
      onStatus('disconnected');
      scheduleReconnect();
    }
  }

  function onOnline() {
    if (stopped) return;
    // fast-path reconnect when network comes back
    attempt = 0;
    start();
  }

  function onVisibility() {
    if (stopped) return;
    if (document.visibilityState === 'visible') {
      // if we got stuck in a backgrounded close, attempt to reconnect
      start();
    }
  }

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);

  start();

  return {
    stop() {
      stopped = true;
      clearReconnectTimer();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        ws?.close();
      } catch {}
      ws = null;
    },
  };
}
