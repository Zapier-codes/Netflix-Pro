// src/utils/contentUtils.ts
import { Movie, TVShow, Drama, ContentRow } from '../types/domain';

export class ShufflingEngine {
  private sessionSeed: number;

  constructor(sessionId?: string) {
    this.sessionSeed = this.hashString(sessionId || Date.now().toString());
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private seededRandom(): number {
    this.sessionSeed = (this.sessionSeed * 1664525 + 1013904223) % 2**32;
    return this.sessionSeed / 2**32;
  }

  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  reset(seed?: string) {
    this.sessionSeed = this.hashString(seed || Date.now().toString());
  }
}

export class DeduplicationEngine {
  deduplicate<T extends { title: string; id: string | number }>(
    items: T[],
    threshold: number = 0.8
  ): T[] {
    const result: T[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const normalizedTitle = this.normalizeTitle(item.title);
      let isDuplicate = false;

      for (const seenTitle of seen) {
        if (this.calculateSimilarity(normalizedTitle, seenTitle) > threshold) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        seen.add(normalizedTitle);
        result.push(item);
      }
    }

    return result;
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  private calculateSimilarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;

    if (longer.length === 0) return 1;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  mergeContent<T extends { id: string | number; title: string; source?: string }>(
    ...sources: T[][]
  ): T[] {
    const all = sources.flat();
    return this.deduplicate(all);
  }
}

export class LiveViewerEngine {
  private seededCounts: Map<string, number> = new Map();
  private peakCounts: Map<string, number> = new Map();
  private trends: Map<string, 'up' | 'down' | 'stable'> = new Map();

  seedViewerCount(contentId: string, basePopularity: number = 0): number {
    const seed = this.generateQuantumSeed(contentId);
    const base = Math.max(10, basePopularity * 100 || 50);
    const variance = Math.sin(seed * Date.now() / 1000) * 30 + Math.cos(seed * 2) * 20;
    const viewers = Math.max(1, Math.round(base + variance));

    this.seededCounts.set(contentId, viewers);
    this.updatePeak(contentId, viewers);
    this.updateTrend(contentId, viewers);

    return viewers;
  }

  private generateQuantumSeed(contentId: string): number {
    let hash = 0;
    for (let i = 0; i < contentId.length; i++) {
      hash = ((hash << 5) - hash) + contentId.charCodeAt(i);
      hash = hash & hash;
    }
    return (Math.abs(hash) / 2**31) * Math.PI * 1.618033988749895;
  }

  private updatePeak(contentId: string, current: number) {
    const peak = this.peakCounts.get(contentId) || 0;
    if (current > peak) {
      this.peakCounts.set(contentId, current);
    }
  }

  private updateTrend(contentId: string, current: number) {
    const previous = this.seededCounts.get(contentId) || current;
    const diff = current - previous;
    if (diff > 5) this.trends.set(contentId, 'up');
    else if (diff < -5) this.trends.set(contentId, 'down');
    else this.trends.set(contentId, 'stable');
  }

  getViewerCount(contentId: string): number {
    return this.seededCounts.get(contentId) || 0;
  }

  getPeakViewers(contentId: string): number {
    return this.peakCounts.get(contentId) || 0;
  }

  getTrend(contentId: string): 'up' | 'down' | 'stable' {
    return this.trends.get(contentId) || 'stable';
  }

  simulateFluctuation(contentId: string): number {
    const current = this.getViewerCount(contentId);
    if (current === 0) return this.seedViewerCount(contentId);

    const quantumNoise = Math.sin(Date.now() / 5000 + current) * 5;
    const newCount = Math.max(1, Math.round(current + quantumNoise));

    this.seededCounts.set(contentId, newCount);
    this.updatePeak(contentId, newCount);
    this.updateTrend(contentId, newCount);

    return newCount;
  }
}

export const shufflingEngine = new ShufflingEngine();
export const deduplicationEngine = new DeduplicationEngine();
export const liveViewerEngine = new LiveViewerEngine();
