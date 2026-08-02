import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { db, Campaign, MeterRecord } from '../db/db';
import { TOWERS } from './towers';
import { campaignLabel, formatIndex, sideLabel } from './utils';
import { NamedBlob } from './exportZip';

interface Resized {
  dataUrl: string;
  w: number;
  h: number;
}

function blobToImage(blob: Blob, maxW = 640): Promise<Resized> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) {
        reject(new Error('Sem canvas'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.72), w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Erro na imagem'));
    };
    img.src = url;
  });
}

export async function buildPdf(campaign: Campaign, includePhotos: boolean): Promise<NamedBlob> {
  const records = await db.records.where('campaignId').equals(campaign.id!).toArray();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297;
  const H = 210;
  const name = campaignLabel(campaign.name, campaign.month, campaign.year);
  const photos = records.filter((r) => r.photo).length;
  const indices = records.filter((r) => r.index !== null && r.index !== undefined).length;

  doc.setFillColor(7, 24, 34);
  doc.rect(0, 0, W, H, 'F');
  doc.setTextColor(103, 232, 249);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(30);
  doc.text('Fotos Hidrômetros', W / 2, 58, { align: 'center' });
  doc.setTextColor(230, 246, 251);
  doc.setFontSize(22);
  doc.text(name, W / 2, 84, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(127, 166, 181);
  doc.text(
    `${photos} fotos  ·  ${indices} índices  ·  ${records.length} unidades`,
    W / 2,
    106,
    { align: 'center' },
  );
  doc.setTextColor(103, 232, 249);
  doc.setFontSize(10);
  doc.text('Leitura organizada por torre, andar e lado.', W / 2, 122, { align: 'center' });

  for (const [ti, tower] of TOWERS.entries()) {
    const recs = records
      .filter((r) => r.towerId === tower.id)
      .sort((a, b) => a.floor - b.floor || a.unit - b.unit);
    if (!recs.length) continue;

    if (ti > 0) doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(7, 24, 34);
    doc.text(`Torre ${tower.id} — ${name}`, 14, 15);

    autoTable(doc, {
      startY: 19,
      head: [['Andar', 'Ap', 'Lado', 'Índice', 'Foto']],
      body: recs.map((r: MeterRecord) => [
        String(r.floor),
        r.aptCode,
        sideLabel(r.side),
        formatIndex(r.index),
        r.photo ? 'Sim' : '—',
      ]),
      styles: { fontSize: 8.5, cellPadding: 1.6, font: 'helvetica' },
      headStyles: { fillColor: [11, 46, 70], textColor: [103, 232, 249], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 248, 252] },
    });

    if (includePhotos) {
      const withPhoto = recs.filter((r) => r.photo);
      const boxW = 60;
      const boxH = 68;
      let x = 14;
      let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? 24;
      y += 8;
      let col = 0;

      for (const r of withPhoto) {
        if (y + boxH > H - 12) {
          doc.addPage();
          x = 14;
          y = 12;
          col = 0;
        }
        try {
          const img = await blobToImage(r.photo!);
          const scale = Math.min(boxW / img.w, boxH / img.h);
          const dw = img.w * scale;
          const dh = img.h * scale;
          doc.addImage(img.dataUrl, 'JPEG', x, y, dw, dh);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(7, 24, 34);
          doc.text(`${r.aptCode}`, x + 2, y + boxH - 2);
        } catch {
          /* ignora imagem com erro */
        }
        col++;
        x += boxW + 4;
        if (col === 4) {
          col = 0;
          x = 14;
          y += boxH + 4;
        }
      }
    }
  }

  const blob = doc.output('blob');
  return { blob, name: `${name}-relatorio.pdf` };
}

export async function exportPdf(campaign: Campaign, includePhotos: boolean): Promise<void> {
  const { blob, name } = await buildPdf(campaign, includePhotos);
  saveAs(blob, name);
}
