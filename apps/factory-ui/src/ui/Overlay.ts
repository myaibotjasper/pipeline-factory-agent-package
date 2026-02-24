export function setConn(el: HTMLElement, s: 'connecting' | 'connected' | 'disconnected') {
  el.textContent = s.toUpperCase();
  el.dataset.state = s;
}

export function setDisconnectedOverlay(overlay: HTMLElement, on: boolean) {
  overlay.style.display = on ? 'flex' : 'none';
}

export function renderEventFeed(feedEl: HTMLElement, events: Array<{ ts: number; type: string; status: string; repo: string }>) {
  const last = events.slice(-8).reverse();
  feedEl.innerHTML = last
    .map((e) => {
      const t = new Date(e.ts).toLocaleTimeString();
      return `<div class="evt ${e.status}"><span class="t">${t}</span> <b>${e.type}</b> <span class="r">${e.repo}</span></div>`;
    })
    .join('');
}
