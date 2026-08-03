import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db, Campaign } from '../db/db';
import { campaignLabel, pad2 } from './utils';
import { watermarkPhoto, formatWatermarkDate } from './watermark';

export interface NamedBlob {
  blob: Blob;
  name: string;
}

export interface ZipOptions {
  towerId?: string;
  watermark?: boolean;
}

export async function buildPhotosZip(
  campaign: Campaign,
  opts: ZipOptions = {},
): Promise<NamedBlob> {
  const all = await db.records
    .where('campaignId')
    .equals(campaign.id!)
    .and((r) => !!r.photo)
    .toArray();
  const records = opts.towerId ? all.filter((r) => r.towerId === opts.towerId) : all;

  const zip = new JSZip();
  for (const r of records) {
    const folder = zip.folder(`Torre ${r.towerId}`)?.folder(`Andar ${pad2(r.floor)}`);
    if (!folder || !r.photo) continue;
    if (opts.watermark) {
      const label = `${r.aptCode} · ${formatWatermarkDate(r.capturedAt)}`;
      folder.file(`${r.towerId}-${r.aptCode}.jpg`, await watermarkPhoto(r.photo, label));
    } else {
      folder.file(`${r.towerId}-${r.aptCode}.jpg`, r.photo);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const baseName = campaignLabel(campaign.name, campaign.month, campaign.year);
  const name = opts.towerId ? `${baseName} · Torre ${opts.towerId}` : baseName;
  return { blob, name: `${name}-fotos.zip` };
}

export async function exportPhotosZip(campaign: Campaign, opts: ZipOptions = {}): Promise<void> {
  const { blob, name } = await buildPhotosZip(campaign, opts);
  saveAs(blob, name);
}
