import { MeterRecord } from '../db/db';

export interface TowerMeasurementStats {
  towerId: string;
  photoCount: number;
  activeTimeMs: number;
  avgSecondsPerPhoto: number;
}

export interface MeasurementStats {
  totalPhotos: number;
  firstCaptureAt: number | null;
  lastCaptureAt: number | null;
  totalSpanMs: number;
  activeTimeMs: number;
  avgSecondsPerPhoto: number;
  photosPerHour: number;
  towerStats: Record<string, TowerMeasurementStats>;
}

const MAX_GAP_MS = 10 * 60 * 1000; // 10 minutos para pausar cronometro ativo

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '0s';
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`.trim();
  }
  if (minutes > 0) {
    return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ''}`;
  }
  return `${seconds}s`;
}

export function formatPace(secondsPerPhoto: number): string {
  if (!secondsPerPhoto || secondsPerPhoto <= 0) return '--';
  const rounded = Math.round(secondsPerPhoto);
  if (rounded < 60) {
    return `${rounded}s/un`;
  }
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s/un`;
}

export function calculateMeasurementStats(records: MeterRecord[]): MeasurementStats {
  const photosWithTime = records
    .filter((r) => r.capturedAt && r.capturedAt > 0)
    .sort((a, b) => (a.capturedAt! - b.capturedAt!));

  if (photosWithTime.length === 0) {
    return {
      totalPhotos: 0,
      firstCaptureAt: null,
      lastCaptureAt: null,
      totalSpanMs: 0,
      activeTimeMs: 0,
      avgSecondsPerPhoto: 0,
      photosPerHour: 0,
      towerStats: {},
    };
  }

  const firstCaptureAt = photosWithTime[0].capturedAt!;
  const lastCaptureAt = photosWithTime[photosWithTime.length - 1].capturedAt!;
  const totalSpanMs = Math.max(0, lastCaptureAt - firstCaptureAt);

  // Agrupar por torre para calcular tempos ativos reais
  const towerMap: Record<string, MeterRecord[]> = {};
  for (const r of photosWithTime) {
    if (!towerMap[r.towerId]) towerMap[r.towerId] = [];
    towerMap[r.towerId].push(r);
  }

  let totalActiveMs = 0;
  const towerStats: Record<string, TowerMeasurementStats> = {};

  for (const [tId, tRecords] of Object.entries(towerMap)) {
    let towerActiveMs = 0;
    const intervals: number[] = [];

    for (let i = 1; i < tRecords.length; i++) {
      const diff = tRecords[i].capturedAt! - tRecords[i - 1].capturedAt!;
      if (diff > 0 && diff <= MAX_GAP_MS) {
        towerActiveMs += diff;
        intervals.push(diff);
      }
    }

    const typicalInterval =
      intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 15000;

    // Se houve apenas 1 foto ou buracos maiores que MAX_GAP_MS
    let adjustedTowerActive = towerActiveMs;
    if (tRecords.length > 1) {
      let gapCount = 0;
      for (let i = 1; i < tRecords.length; i++) {
        const diff = tRecords[i].capturedAt! - tRecords[i - 1].capturedAt!;
        if (diff > MAX_GAP_MS || diff <= 0) gapCount++;
      }
      adjustedTowerActive += gapCount * typicalInterval;
    }

    const avgSec = tRecords.length > 1 ? (adjustedTowerActive / 1000) / (tRecords.length - 1) : 0;
    towerStats[tId] = {
      towerId: tId,
      photoCount: tRecords.length,
      activeTimeMs: adjustedTowerActive,
      avgSecondsPerPhoto: avgSec,
    };
    totalActiveMs += adjustedTowerActive;
  }

  const avgSecondsPerPhoto =
    photosWithTime.length > 1 ? (totalActiveMs / 1000) / (photosWithTime.length - 1) : 0;

  const photosPerHour =
    avgSecondsPerPhoto > 0 ? Math.round(3600 / avgSecondsPerPhoto) : 0;

  return {
    totalPhotos: photosWithTime.length,
    firstCaptureAt,
    lastCaptureAt,
    totalSpanMs,
    activeTimeMs: totalActiveMs,
    avgSecondsPerPhoto,
    photosPerHour,
    towerStats,
  };
}
