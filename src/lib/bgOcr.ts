import { useEffect, useState } from 'react';
import { db } from '../db/db';
import { recognizeMeter } from './ocr';

export interface BgOcrState {
  isRunning: boolean;
  campaignId: number | null;
  total: number;
  processed: number;
  successCount: number;
  currentApt: string | null;
  error: string | null;
}

export class BgOcrManager {
  private state: BgOcrState = {
    isRunning: false,
    campaignId: null,
    total: 0,
    processed: 0,
    successCount: 0,
    currentApt: null,
    error: null,
  };

  private listeners = new Set<(s: BgOcrState) => void>();
  private abortController: AbortController | null = null;

  getState(): BgOcrState {
    return { ...this.state };
  }

  subscribe(fn: (s: BgOcrState) => void): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => this.listeners.delete(fn);
  }

  private notify() {
    const curr = this.getState();
    for (const fn of this.listeners) {
      fn(curr);
    }
  }

  async start(campaignId: number, options: { forceAll?: boolean } = {}): Promise<void> {
    if (this.state.isRunning) {
      if (this.state.campaignId === campaignId) return;
      this.stop();
    }

    this.abortController = new AbortController();
    const { signal } = this.abortController;

    // Buscar registros que tem foto mas nao tem indice preenchido
    const allRecords = await db.records.where('campaignId').equals(campaignId).toArray();
    const pending = allRecords.filter((r) => {
      if (!r.photo) return false;
      if (options.forceAll) return true;
      return r.index === null || r.index === undefined;
    });

    if (pending.length === 0) {
      this.state = {
        isRunning: false,
        campaignId,
        total: 0,
        processed: 0,
        successCount: 0,
        currentApt: null,
        error: null,
      };
      this.notify();
      return;
    }

    this.state = {
      isRunning: true,
      campaignId,
      total: pending.length,
      processed: 0,
      successCount: 0,
      currentApt: pending[0].aptCode,
      error: null,
    };
    this.notify();

    let processed = 0;
    let successCount = 0;

    for (const rec of pending) {
      if (signal.aborted) break;

      this.state.currentApt = rec.aptCode;
      this.notify();

      try {
        if (rec.photo) {
          const res = await recognizeMeter(rec.photo);
          if (res.value !== null && !signal.aborted) {
            const now = Date.now();
            await db.records.update(rec.id!, {
              index: res.value,
              indexedAt: now,
              updatedAt: now,
            });
            successCount++;
          }
        }
      } catch (err) {
        console.warn(`BgOCR erro no apt ${rec.aptCode}:`, err);
      }

      processed++;
      this.state.processed = processed;
      this.state.successCount = successCount;
      this.notify();

      // Intervalo suave de 120ms para ceder a thread principal e manter o app fluido
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    this.state.isRunning = false;
    this.state.currentApt = null;
    this.abortController = null;
    this.notify();
  }

  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.state.isRunning = false;
    this.state.currentApt = null;
    this.notify();
  }
}

export const bgOcr = new BgOcrManager();

export function useBgOcr(campaignId?: number) {
  const [state, setState] = useState<BgOcrState>(() => bgOcr.getState());

  useEffect(() => {
    return bgOcr.subscribe((s) => setState(s));
  }, []);

  const start = (targetCampaignId?: number, options?: { forceAll?: boolean }) => {
    const id = targetCampaignId ?? campaignId;
    if (id) void bgOcr.start(id, options);
  };

  const stop = () => bgOcr.stop();

  const progressPct =
    state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;

  return {
    ...state,
    progressPct,
    start,
    stop,
  };
}
