import fs from 'node:fs';
import path from 'node:path';

export type DodItem = {
  id: string;
  title: string;
  status: 'done' | 'partial' | 'not_done';
  evidence?: { title: string; url: string }[];
};

export type ProgressStatus = {
  ts: number;
  current: string | null;
  next: string[];
  blockers: string[];
  dod: {
    overall: 'DONE' | 'NOT DONE';
    items: DodItem[];
  };
  deploy: {
    sha: string | null;
    deployedAt: string | null;
  };
  ci: {
    status: 'success' | 'failure' | 'unknown';
    url: string | null;
    updatedAt: string | null;
  };
};

export type RoadmapItem = {
  id: string;
  priority: 'P0' | 'P1' | 'P2';
  title: string;
  status: 'done' | 'partial' | 'not_done';
};

export type Roadmap = {
  ts: number;
  items: RoadmapItem[];
  percentComplete: {
    P0: number;
    P1: number;
    P2: number;
    overall: number;
  };
};

type ProgressFile = {
  current?: string | null;
  next?: string[];
  blockers?: string[];
  dod?: { items?: DodItem[] };
  roadmap?: { items?: RoadmapItem[] };
};

function pct(items: RoadmapItem[]) {
  if (!items.length) return 0;
  const done = items.filter((i) => i.status === 'done').length;
  return Math.round((done / items.length) * 100);
}

export class ProgressStore {
  private filePath: string;
  private lastReadMs = 0;
  private cached: ProgressFile = {};

  constructor(progressPath: string) {
    this.filePath = progressPath;
  }

  private safeRead() {
    const now = Date.now();
    // simple cache to avoid disk churn
    if (now - this.lastReadMs < 1000) return;
    this.lastReadMs = now;

    try {
      const p = path.resolve(this.filePath);
      const raw = fs.readFileSync(p, 'utf8');
      this.cached = JSON.parse(raw);
    } catch {
      this.cached = {};
    }
  }

  getStatus(dynamic: {
    deploySha: string | null;
    deployedAt: string | null;
    ciStatus: 'success' | 'failure' | 'unknown';
    ciUrl: string | null;
    ciUpdatedAt: string | null;
  }): ProgressStatus {
    this.safeRead();

    const items = this.cached.dod?.items || [];
    const overall = items.every((i) => i.status === 'done') && items.length > 0 ? 'DONE' : 'NOT DONE';

    return {
      ts: Date.now(),
      current: this.cached.current ?? null,
      next: this.cached.next ?? [],
      blockers: this.cached.blockers ?? [],
      dod: { overall, items },
      deploy: { sha: dynamic.deploySha, deployedAt: dynamic.deployedAt },
      ci: { status: dynamic.ciStatus, url: dynamic.ciUrl, updatedAt: dynamic.ciUpdatedAt },
    };
  }

  getRoadmap(): Roadmap {
    this.safeRead();
    const items: RoadmapItem[] = this.cached.roadmap?.items || [];

    const p0 = items.filter((i) => i.priority === 'P0');
    const p1 = items.filter((i) => i.priority === 'P1');
    const p2 = items.filter((i) => i.priority === 'P2');
    const overall = pct(items);

    return {
      ts: Date.now(),
      items,
      percentComplete: { P0: pct(p0), P1: pct(p1), P2: pct(p2), overall },
    };
  }
}
