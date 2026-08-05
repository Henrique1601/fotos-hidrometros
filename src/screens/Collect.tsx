import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, ArrowRight, Check, Loader2, ScanText, Search, Trophy } from 'lucide-react';
import { db } from '../db/db';
import { upsertRecord, resetRecord } from '../db/records';
import { batchRecognizeMeters } from '../lib/ocr';
import {
  aptCode,
  floorSequence,
  SIDE_ORDER,
  Side,
  towerById,
  UnitRef,
} from '../lib/towers';
import { campaignLabel, pad2 } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import ProgressRing from '../components/ProgressRing';
import AptButton from '../components/AptButton';
import CameraOverlay from '../components/CameraOverlay';
import ConfirmModal from '../components/ConfirmModal';
import { Screen } from '../nav';

interface Props {
  campaignId: number;
  towerId?: string;
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function Collect({ campaignId, towerId: initialTower, go, toast }: Props) {
  const [towerId, setTowerId] = useState(initialTower ?? 'A');
  const [floor, setFloor] = useState(3);
  const [camApt, setCamApt] = useState<UnitRef | null>(null);
  const [jump, setJump] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<UnitRef | null>(null);

  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const tower = useMemo(() => towerById(towerId), [towerId]);
  const records =
    useLiveQuery(() => db.records.where('campaignId').equals(campaignId).toArray(), [campaignId]) ?? [];
  const towerRecords = useMemo(() => records.filter((r) => r.towerId === towerId), [records, towerId]);

  const photoSet = useMemo(
    () => new Set(towerRecords.filter((r) => r.photo).map((r) => r.aptCode)),
    [towerRecords],
  );
  const indexSet = useMemo(
    () => new Set(towerRecords.filter((r) => r.index !== null && r.index !== undefined).map((r) => r.aptCode)),
    [towerRecords],
  );

  const total = useMemo(() => tower.floors.reduce((a, f) => a + f.units.length, 0), [tower]);
  const photosCount = photoSet.size;

  useEffect(() => {
    const defaultFloor =
      tower.floors.find((f) => f.units.some((u) => !photoSet.has(aptCode(f.floor, u))))?.floor ??
      tower.floors[0].floor;
    setFloor(defaultFloor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towerId]);

  useEffect(() => {
    if (!campaign) return;
    db.campaigns.update(campaignId, { lastTower: towerId, lastFloor: floor });
  }, [towerId, floor, campaignId, campaign]);

  const columnApts = useCallback(
    (side: Side): UnitRef[] => {
      const floorCfg = tower.floors.find((f) => f.floor === floor);
      if (!floorCfg) return [];
      return SIDE_ORDER[side]
        .filter((u) => floorCfg.units.includes(u))
        .reverse()
        .map((u) => ({ floor, unit: u, aptCode: aptCode(floor, u), side }));
    },
    [tower, floor],
  );

  const colRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = colRef.current;
      if (!el) return;
      gsap.fromTo(
        el.querySelectorAll('.apt-btn'),
        { opacity: 0, y: 12, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, stagger: 0.025, duration: 0.32, ease: 'power2.out' },
      );
    },
    { dependencies: [floor, towerId] },
  );

  const handleSaved = useCallback(async (ocrIndex?: number) => {
    if (ocrIndex != null && camApt) {
      await upsertRecord({
        campaignId,
        towerId,
        floor: camApt.floor,
        unit: camApt.unit,
        side: camApt.side,
        aptCode: camApt.aptCode,
        index: ocrIndex,
        indexedAt: Date.now(),
      });
    }
    const seq = floorSequence(tower);
    const idx = camApt ? seq.findIndex((u) => u.aptCode === camApt.aptCode) : -1;
    const next = seq[idx + 1];
    if (next) {
      setFloor(next.floor);
      setCamApt(next);
    } else {
      setCamApt(null);
      toast(`Torre ${towerId} completa!`);
    }
  }, [camApt, tower, towerId, toast, campaignId]);

  const handlePrev = useCallback(() => {
    if (!camApt) return;
    const seq = floorSequence(tower);
    const idx = seq.findIndex((u) => u.aptCode === camApt.aptCode);
    const prev = idx > 0 ? seq[idx - 1] : null;
    if (prev) {
      setFloor(prev.floor);
      setCamApt(prev);
    }
  }, [camApt, tower]);

  const camPrev = useMemo(() => {
    if (!camApt) return null;
    const seq = floorSequence(tower);
    const idx = seq.findIndex((u) => u.aptCode === camApt.aptCode);
    return idx > 0 ? seq[idx - 1] : null;
  }, [camApt, tower]);

  const floorComplete = useMemo(() => {
    const floorCfg = tower.floors.find((f) => f.floor === floor);
    return floorCfg ? floorCfg.units.every((u) => photoSet.has(aptCode(floor, u))) : false;
  }, [tower, floor, photoSet]);

  const handleJump = (e: FormEvent) => {
    e.preventDefault();
    const code = jump.trim();
    if (!code) return;
    const u = floorSequence(tower).find((x) => x.aptCode === code);
    if (u) {
      setFloor(u.floor);
      setCamApt(u);
      toast(`Abrindo ${code}…`);
    } else {
      toast('Apt não encontrado nesta torre.');
    }
  };

  const handleDeletePhoto = () => {
    if (!deleteTarget) return;
    void resetRecord(campaignId, deleteTarget.aptCode, towerId);
    setDeleteTarget(null);
    toast(`Foto de ${deleteTarget.aptCode} removida.`);
  };

  const handleBatchOcr = async () => {
    const withPhoto = towerRecords.filter((r) => r.photo && (r.index === null || r.index === undefined));
    if (withPhoto.length === 0) {
      toast('Nenhuma foto sem índice nesta torre.');
      return;
    }
    setBatchBusy(true);
    setBatchProgress({ done: 0, total: withPhoto.length });
    try {
      const photos = withPhoto.map((r) => ({ aptCode: r.aptCode, photo: r.photo! }));
      const results = await batchRecognizeMeters(photos, (done, total) =>
        setBatchProgress({ done, total }),
      );
      let filled = 0;
      for (const { aptCode: code, result } of results) {
        if (result.value != null) {
          const rec = withPhoto.find((r) => r.aptCode === code);
          if (rec) {
            await upsertRecord({
              campaignId,
              towerId: rec.towerId,
              floor: rec.floor,
              unit: rec.unit,
              side: rec.side,
              aptCode: rec.aptCode,
              index: result.value,
              indexedAt: Date.now(),
            });
            filled++;
          }
        }
      }
      toast(`OCR em lote: ${filled}/${withPhoto.length} índices preenchidos.`);
    } catch (e) {
      console.warn('Batch OCR error:', e);
      toast('Erro no OCR em lote.');
    } finally {
      setBatchBusy(false);
      setBatchProgress({ done: 0, total: 0 });
    }
  };

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">
            {campaign ? campaignLabel(campaign.name, campaign.month, campaign.year) : ''}
          </h2>
          <span className="header-sub">
            {photosCount}/{total} fotos
          </span>
        </div>
        <div className="header-spacer">
          <ProgressRing value={photosCount / total} size={40} stroke={4} />
        </div>
      </header>

      <div className="chip-row">
        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((id) => (
          <button
            key={id}
            className={`chip${id === towerId ? ' chip-active' : ''}`}
            onClick={() => setTowerId(id)}
            aria-label={`Torre ${id}`}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="chip-row floors">
        {tower.floors.map((f) => {
          const done = f.units.every((u) => photoSet.has(aptCode(f.floor, u)));
          return (
            <button
              key={f.floor}
              className={`chip floor-chip${f.floor === floor ? ' chip-active' : ''}${done ? ' chip-done' : ''}`}
              onClick={() => setFloor(f.floor)}
            >
              {done && <Check size={10} aria-hidden />}
              {pad2(f.floor)}
            </button>
          );
        })}
      </div>

      <form className="apt-jump" onSubmit={handleJump} role="search">
        <Search size={16} aria-hidden="true" />
        <input
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          placeholder="Ir para apt (ex.: 258)"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Buscar apartamento"
        />
      </form>

      <div className="collect-toolbar">
        <button
          className="btn-ghost"
          onClick={() => void handleBatchOcr()}
          disabled={batchBusy}
        >
          {batchBusy ? <Loader2 size={16} className="spin" /> : <ScanText size={16} />}
          {batchBusy ? `OCR ${batchProgress.done}/${batchProgress.total}` : 'OCR em lote'}
        </button>
        <button
          className="btn-ghost"
          onClick={() => go({ name: 'indices', campaignId })}
        >
          <ScanText size={16} /> Preencher índices
        </button>
      </div>

      <div className="floor-heading">
        <h3 className="display-small">Andar {pad2(floor)}</h3>
        {floorComplete && (
          <span className="done-pill">
            <Check size={12} /> Completo
          </span>
        )}
      </div>

      <div className="columns" ref={colRef}>
        <div className="column">
          <div className="column-header left">
            <span className="side-arrow">
              <ArrowLeft size={14} />
            </span>
            Esquerda
            <span className="column-count">
              {columnApts('left').filter((a) => photoSet.has(a.aptCode)).length}/
              {columnApts('left').length}
            </span>
          </div>
          <div className="column-grid">
            {columnApts('left').map((a) => (
              <AptButton
                  key={a.aptCode}
                  apt={a}
                  hasPhoto={photoSet.has(a.aptCode)}
                  hasIndex={indexSet.has(a.aptCode)}
                  photo={towerRecords.find((r) => r.aptCode === a.aptCode)?.photo}
                  onTap={() => setCamApt(a)}
                  onDelete={() => setDeleteTarget(a)}
                  onHistory={() => go({ name: 'history', towerId, aptCode: a.aptCode })}
                />
              ))}
          </div>
        </div>

        <div className="column">
          <div className="column-header right">
            <span className="side-arrow">
              <ArrowRight size={14} />
            </span>
            Direita
            <span className="column-count">
              {columnApts('right').filter((a) => photoSet.has(a.aptCode)).length}/
              {columnApts('right').length}
            </span>
          </div>
          <div className="column-grid">
            {columnApts('right').map((a) => (
              <AptButton
                  key={a.aptCode}
                  apt={a}
                  hasPhoto={photoSet.has(a.aptCode)}
                  hasIndex={indexSet.has(a.aptCode)}
                  photo={towerRecords.find((r) => r.aptCode === a.aptCode)?.photo}
                  onTap={() => setCamApt(a)}
                  onDelete={() => setDeleteTarget(a)}
                  onHistory={() => go({ name: 'history', towerId, aptCode: a.aptCode })}
                />
              ))}
          </div>
        </div>
      </div>

      {photosCount === total && (
        <GlassCard className="done-banner">
          <Trophy size={22} />
          <span>Torre {towerId} 100% fotografada!</span>
        </GlassCard>
      )}

      {camApt && (
        <CameraOverlay
          key={camApt.aptCode}
          campaignId={campaignId}
          towerId={towerId}
          apt={camApt}
          onPrev={camPrev ? handlePrev : undefined}
          onSaved={() => void handleSaved()}
          onClose={() => setCamApt(null)}
          toast={toast}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Remover foto?"
        message={`Remover a foto e o índice do apartamento ${deleteTarget?.aptCode}?`}
        danger
        confirmLabel="Remover"
        onConfirm={() => void handleDeletePhoto()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
