export type UIMode = 'wallboard' | 'laptop' | 'mobile';

export function detectMode(): UIMode {
  const u = new URL(window.location.href);
  const forced = (u.searchParams.get('mode') || '').toLowerCase();
  if (forced === 'wallboard' || forced === 'laptop' || forced === 'mobile') return forced as UIMode;

  const w = window.innerWidth;
  if (w <= 720) return 'mobile';
  if (w <= 1200) return 'laptop';
  return 'wallboard';
}
