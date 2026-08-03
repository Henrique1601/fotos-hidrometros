import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { db, Campaign } from '../db/db';
import { campaignLabel, sideLabel } from './utils';
import { loadConsumption, keyOf } from './consumption';
import { NamedBlob } from './exportZip';

export interface ExcelOptions {
  towerId?: string;
}

export async function buildExcel(campaign: Campaign, opts: ExcelOptions = {}): Promise<NamedBlob> {
  const all = await db.records.where('campaignId').equals(campaign.id!).toArray();
  const records = (opts.towerId ? all.filter((r) => r.towerId === opts.towerId) : all).sort(
    (a, b) => a.towerId.localeCompare(b.towerId) || a.floor - b.floor || a.unit - b.unit,
  );
  const consumption = await loadConsumption(campaign, records);

  const rows: (string | number)[][] = [['Torre', 'Andar', 'Ap', 'Lado', 'Índice', 'Consumo']];
  for (const r of records) {
    const c = consumption.get(keyOf(r.towerId, r.aptCode));
    rows.push([
      `Torre ${r.towerId}`,
      r.floor,
      r.aptCode,
      sideLabel(r.side),
      r.index !== null && r.index !== undefined ? r.index : '',
      c?.consumption ?? '',
    ]);
  }

  const idxSheet = XLSX.utils.aoa_to_sheet(rows);
  idxSheet['!cols'] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
  ];

  const towers = new Map<string, { total: number; photos: number; indices: number }>();
  for (const r of records) {
    const t = towers.get(r.towerId) ?? { total: 0, photos: 0, indices: 0 };
    t.total++;
    if (r.photo) t.photos++;
    if (r.index !== null && r.index !== undefined) t.indices++;
    towers.set(r.towerId, t);
  }
  const sumRows: (string | number)[][] = [['Torre', 'Unidades', 'Fotos', 'Índices']];
  for (const [id, t] of [...towers.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    sumRows.push([`Torre ${id}`, t.total, t.photos, t.indices]);
  }
  const sumSheet = XLSX.utils.aoa_to_sheet(sumRows);
  sumSheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];

  const consRows: (string | number)[][] = [
    ['Torre', 'Ap', 'Índice Anterior', 'Índice Atual', 'Consumo', 'Status'],
  ];
  for (const r of records) {
    const c = consumption.get(keyOf(r.towerId, r.aptCode));
    if (!c || c.consumption === null) continue;
    consRows.push([
      `Torre ${r.towerId}`,
      r.aptCode,
      c.previousIndex ?? '',
      r.index ?? '',
      c.consumption,
      c.status === 'anomaly' ? 'Anomalia' : 'OK',
    ]);
  }
  const consSheet = XLSX.utils.aoa_to_sheet(consRows);
  consSheet['!cols'] = [
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, idxSheet, 'Índices');
  XLSX.utils.book_append_sheet(wb, consSheet, 'Consumo');
  XLSX.utils.book_append_sheet(wb, sumSheet, 'Resumo');

  const baseName = campaignLabel(campaign.name, campaign.month, campaign.year);
  const name = opts.towerId ? `${baseName} · Torre ${opts.towerId}` : baseName;
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return { blob, name: `${name}-indices.xlsx` };
}

export async function exportExcel(campaign: Campaign, opts: ExcelOptions = {}): Promise<void> {
  const { blob, name } = await buildExcel(campaign, opts);
  saveAs(blob, name);
}
