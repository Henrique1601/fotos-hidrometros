import { db, Campaign } from '../db/db';

export const ANOMALY_LIMIT_M3 = 30;

export type ConsumptionStatus = 'ok' | 'anomaly' | 'no-base';

export interface Consumption {
  previousIndex: number | null;
  consumption: number | null;
  status: ConsumptionStatus;
}

export interface RecordLike {
  towerId: string;
  aptCode: string;
  index?: number | null;
}

export function keyOf(towerId: string, aptCode: string): string {
  return `${towerId}:${aptCode}`;
}

export function selectPreviousCampaign(
  campaigns: Campaign[],
  current: Campaign,
): Campaign | null {
  const prev = campaigns
    .filter(
      (c) =>
        c.id !== current.id &&
        (c.year < current.year || (c.year === current.year && c.month < current.month)),
    )
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];
  return prev ?? null;
}

export function computeConsumption(
  records: RecordLike[],
  prevIndexByKey: Map<string, number | null | undefined>,
): Map<string, Consumption> {
  const map = new Map<string, Consumption>();
  for (const r of records) {
    const key = keyOf(r.towerId, r.aptCode);
    const prevIdx = prevIndexByKey.has(key) ? (prevIndexByKey.get(key) ?? null) : null;
    const curIdx = r.index ?? null;
    let consumption: number | null = null;
    let status: ConsumptionStatus = 'no-base';
    if (prevIdx !== null && curIdx !== null) {
      consumption = curIdx - prevIdx;
      status = consumption < 0 || consumption > ANOMALY_LIMIT_M3 ? 'anomaly' : 'ok';
    }
    map.set(key, { previousIndex: prevIdx, consumption, status });
  }
  return map;
}

export async function loadConsumption(
  campaign: Campaign,
  records: RecordLike[],
): Promise<Map<string, Consumption>> {
  const campaigns = await db.campaigns.toArray();
  const prev = selectPreviousCampaign(campaigns, campaign);
  if (!prev) {
    return computeConsumption(records, new Map());
  }
  const prevRecords = await db.records.where('campaignId').equals(prev.id!).toArray();
  const prevByKey = new Map(prevRecords.map((r) => [keyOf(r.towerId, r.aptCode), r.index]));
  return computeConsumption(records, prevByKey);
}
