import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { db, Campaign } from '../db/db';
import { campaignLabel, pad2 } from './utils';

export async function exportPhotosZip(campaign: Campaign): Promise<void> {
  const records = await db.records
    .where('campaignId')
    .equals(campaign.id!)
    .and((r) => !!r.photo)
    .toArray();

  const zip = new JSZip();
  for (const r of records) {
    const folder = zip.folder(`Torre_${r.towerId}`)?.folder(pad2(r.floor));
    if (folder && r.photo) {
      folder.file(`ap_${r.aptCode}.jpg`, r.photo);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const name = campaignLabel(campaign.name, campaign.month, campaign.year);
  saveAs(blob, `${name}-fotos.zip`);
}
