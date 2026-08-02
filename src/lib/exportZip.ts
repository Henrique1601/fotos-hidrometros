import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db, Campaign } from '../db/db';
import { campaignLabel, pad2 } from './utils';

export interface NamedBlob {
  blob: Blob;
  name: string;
}

export async function buildPhotosZip(campaign: Campaign): Promise<NamedBlob> {
  const records = await db.records
    .where('campaignId')
    .equals(campaign.id!)
    .and((r) => !!r.photo)
    .toArray();

  const zip = new JSZip();
  for (const r of records) {
    const folder = zip.folder(`Torre ${r.towerId}`)?.folder(`Andar ${pad2(r.floor)}`);
    if (folder && r.photo) {
      folder.file(`${r.towerId}-${r.aptCode}.jpg`, r.photo);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const name = campaignLabel(campaign.name, campaign.month, campaign.year);
  return { blob, name: `${name}-fotos.zip` };
}

export async function exportPhotosZip(campaign: Campaign): Promise<void> {
  const { blob, name } = await buildPhotosZip(campaign);
  saveAs(blob, name);
}
