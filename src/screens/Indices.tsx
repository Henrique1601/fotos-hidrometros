import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Clock, ImageOff, Maximize2, Pause, Play, ScanText, Search, Sparkles, Undo2, X } from 'lucide-react';
import { db } from '../db/db';
import { upsertRecord } from '../db/records';
import { floorSequence, towerById, UnitRef } from '../lib/towers';
import { campaignLabel, formatIndex, pad2, parseIndex, sideLabel } from '../lib/utils';
import { validateIndex } from '../lib/validate';
import type { IndexWarning } from '../lib/validate';
import { recognizeMeter } from '../lib/ocr';
import { useBgOcr } from '../lib/bgOcr';
import { loadConsumption } from '../lib/consumption';
import GlassCard from '../components/GlassCard';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { Screen } from '../nav';

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
  toast: (msg: string) => void;
}

export default function Indices({ campaignId, go, toast }: Props) {
  const [towerId, setTowerId] = useState('A');
  const [pos, setPos] = useState(0);
  const [value, setValue] = useState('');
  const [warnings, setWarnings] = useState<IndexWarning[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [jump, setJump] = useState('');
  const [jumpMsg, setJumpMsg] = useState<string | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ aptCode: string; prevIndex: number | null; prevRaw: string } | null>(null);
  const [zoomModal, setZoomModal] = useState(false);
  const bgOcr = useBgOcr(campaignId);
  const inputRef = useRef<HTMLInputElement>(null);

  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const tower = useMemo(() => towerById(towerId), [towerId]);
  const records =
    useLiveQuery(() => db.records.where('campaignId').equals(campaignId).toArray(), [campaignId]) ?? [];
  const towerRecords = useMemo(() => records.filter((r) => r.towerId === towerId), [records, towerId]);

  const recordByApt = useMemo(() => new Map(towerRecords.map((r) => [r.aptCode, r])), [towerRecords]);

  const [prevIndexMap, setPrevIndexMap] = useState<Map<string, number | null>>(new Map());
  useEffect(() => {
    if (!campaign) return;
    loadConsumption(campaign, towerRecords).then((consumptionMap) => {
      const map = new Map<string, number | null>();
      consumptionMap.forEach((v, k) => map.set(k, v.previousIndex));
      setPrevIndexMap(map);
    });
  }, [campaign, towerRecords]);

  const photoUnits = useMemo(
    () => floorSequence(tower).filter((u) => Boolean(recordByApt.get(u.aptCode)?.photo)),
    [tower, recordByApt],
  );

  const indexDone = useMemo(
    () =>
      photoUnits.filter((u) => {
        const idx = recordByApt.get(u.aptCode)?.index;
        return idx !== null && idx !== undefined;
      }).length,
    [photoUnits, recordByApt],
  );

  const pendingPhotosCount = useMemo(
    () => records.filter((r) => r.photo && (r.index === null || r.index === undefined)).length,
    [records],
  );

  const apt = photoUnits[pos];

  useEffect(() => {
    const firstMissing = photoUnits.findIndex((u) => {
      const idx = recordByApt.get(u.aptCode)?.index;
      return idx === null || idx === undefined;
    });
    setPos(firstMissing >= 0 ? firstMissing : 0);
    setJumpMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towerId]);

  useEffect(() => {
    if (!apt) {
      setValue('');
      setWarnings([]);
      setInvalid(false);
      return;
    }
    const idx = recordByApt.get(apt.aptCode)?.index;
    setValue(idx !== null && idx !== undefined ? formatIndex(idx) : '');
    setWarnings([]);
    setInvalid(false);
    setLastSaved(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apt?.aptCode, towerRecords]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [apt?.aptCode]);

  const save = useCallback(
    async (u: UnitRef, raw: string): Promise<boolean> => {
      const parsed = parseIndex(raw);
      if (parsed === null) return false;
      const prev = recordByApt.get(u.aptCode)?.index;
      const prevRaw = recordByApt.get(u.aptCode)?.index != null ? formatIndex(recordByApt.get(u.aptCode)!.index!) : '';
      const peerList = towerRecords
        .filter((r) => r.index !== null && r.index !== undefined && r.aptCode !== u.aptCode)
        .map((r) => r.index as number);
      await upsertRecord({
        campaignId,
        towerId,
        floor: u.floor,
        unit: u.unit,
        side: u.side,
        aptCode: u.aptCode,
        index: parsed,
        indexedAt: Date.now(),
      });
      setLastSaved({ aptCode: u.aptCode, prevIndex: prev ?? null, prevRaw });
      setWarnings(validateIndex(parsed, prev, peerList));
      setInvalid(false);
      return true;
    },
    [campaignId, towerId, towerRecords, recordByApt],
  );

  const handleUndo = useCallback(async () => {
    if (!lastSaved || !apt || lastSaved.aptCode !== apt.aptCode) return;
    const rec = recordByApt.get(apt.aptCode);
    if (!rec) return;
    await upsertRecord({
      campaignId,
      towerId,
      floor: apt.floor,
      unit: apt.unit,
      side: apt.side,
      aptCode: apt.aptCode,
      index: lastSaved.prevIndex,
      indexedAt: lastSaved.prevIndex !== null ? Date.now() : undefined,
    });
    setValue(lastSaved.prevRaw);
    setWarnings([]);
    setInvalid(false);
    setLastSaved(null);
    toast('Índice desfeito.');
  }, [lastSaved, apt, campaignId, towerId, recordByApt, toast]);

  const canGo = useCallback((): boolean => {
    if (!value.trim()) return true;
    if (parseIndex(value) === null) {
      setInvalid(true);
      return false;
    }
    return true;
  }, [value]);

  const handleNext = useCallback(async () => {
    if (!apt) return;
    if (value.trim()) {
      if (!(await save(apt, value))) return;
    }
    if (pos < photoUnits.length - 1) setPos(pos + 1);
  }, [apt, value, save, pos, photoUnits.length]);

  const handleBack = useCallback(() => {
    if (pos > 0) setPos(pos - 1);
  }, [pos]);

  const handleEnter = useCallback(async () => {
    if (!apt) return;
    if (!canGo()) return;
    if (value.trim()) await save(apt, value);
    if (pos < photoUnits.length - 1) setPos(pos + 1);
  }, [apt, value, save, canGo, pos, photoUnits.length]);

  const handleJump = (e: FormEvent) => {
    e.preventDefault();
    const code = jump.trim();
    if (!code) return;
    const idx = photoUnits.findIndex((u) => u.aptCode === code);
    if (idx >= 0) {
      setPos(idx);
      setJumpMsg(null);
    } else {
      setJumpMsg('Apt não encontrado nesta torre.');
    }
  };

  const handleReadPhoto = async () => {
    if (!apt || ocrBusy) return;
    const rec = recordByApt.get(apt.aptCode);
    if (!rec?.photo) {
      toast('Sem foto para ler.');
      return;
    }
    setOcrBusy(true);
    try {
      const result = await recognizeMeter(rec.photo);
      if (result.value !== null) {
        setValue(formatIndex(result.value));
        setWarnings([]);
        setInvalid(false);
        inputRef.current?.focus();
        toast(`OCR detectou: ${formatIndex(result.value)}`);
      } else {
        toast('Não li o índice. Preencha manualmente.');
      }
    } catch (e) {
      console.warn('OCR erro:', e);
      toast('OCR indisponível. Preencha manualmente.');
    } finally {
      setOcrBusy(false);
    }
  };

  const prevIdx = apt ? prevIndexMap.get(apt.aptCode) : null;

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
            Índices {indexDone}/{photoUnits.length}
          </span>
        </div>
        <span className="header-spacer" />
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

      {pendingPhotosCount > 0 && (
        <div className="bg-ocr-banner">
          <div className="bg-ocr-info">
            <Sparkles size={16} className={`bg-ocr-icon${bgOcr.isRunning ? ' spin' : ''}`} />
            <div>
              <strong className="bg-ocr-title">OCR em 2º plano</strong>
              <p className="bg-ocr-sub">
                {bgOcr.isRunning
                  ? `Processando ${bgOcr.currentApt ? `Apt ${bgOcr.currentApt}` : ''} (${bgOcr.processed}/${bgOcr.total})`
                  : bgOcr.successCount > 0
                  ? `${bgOcr.successCount} índices lidos automaticamente`
                  : `${pendingPhotosCount} fotos pendentes de leitura`}
              </p>
            </div>
          </div>
          <button
            className={`btn-sm ${bgOcr.isRunning ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => (bgOcr.isRunning ? bgOcr.stop() : bgOcr.start(campaignId))}
            aria-label={bgOcr.isRunning ? 'Pausar OCR' : 'Processar fotos com OCR'}
          >
            {bgOcr.isRunning ? <Pause size={14} /> : <Play size={14} />}
            {bgOcr.isRunning ? 'Pausar' : 'Ler todas'}
          </button>
        </div>
      )}

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
        {jumpMsg && <span className="apt-jump-msg">{jumpMsg}</span>}
      </form>

      {apt ? (
        <div className="iv">
          <div className="iv-photo-wrap" onClick={() => setZoomModal(true)}>
            <AptPhoto blob={recordByApt.get(apt.aptCode)?.photo} aptCode={apt.aptCode} />
            <span className="iv-badge mono">{apt.aptCode}</span>
            <span className="iv-zoom-hint">
              <Maximize2 size={12} /> Toque p/ ampliar
            </span>
            <span className="iv-meta">
              Andar {pad2(apt.floor)} · {sideLabel(apt.side)}
            </span>
            {recordByApt.get(apt.aptCode)?.index !== null &&
              recordByApt.get(apt.aptCode)?.index !== undefined && (
                <span className="iv-filled">
                  <Check size={12} /> Salvo
                  {lastSaved && lastSaved.aptCode === apt.aptCode && (
                    <button
                      className="iv-undo"
                      onClick={() => void handleUndo()}
                      aria-label="Desfazer índice"
                      title="Desfazer"
                    >
                      <Undo2 size={12} />
                    </button>
                  )}
                </span>
              )}
          </div>

          <div className="iv-panel">
            {prevIdx !== null && prevIdx !== undefined && (
              <div className="iv-prev">
                <Clock size={14} />
                <span>Índice anterior: <strong className="mono">{formatIndex(prevIdx)}</strong></span>
              </div>
            )}
            <label className="field-label" htmlFor="iv-input">
              Índice do hidrômetro
            </label>
            <div className="iv-input-row">
              <input
                id="iv-input"
                ref={inputRef}
                className={`iv-input${invalid ? ' iv-input-invalid' : ''}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="Digite o índice"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setInvalid(false);
                  setWarnings([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleEnter();
                }}
                onBlur={() => {
                  if (value.trim() && parseIndex(value) !== null) void save(apt, value);
                }}
                aria-label={`Índice do apartamento ${apt.aptCode}`}
              />
              <button
                className="ocr-btn"
                onClick={() => void handleReadPhoto()}
                disabled={ocrBusy || !recordByApt.get(apt.aptCode)?.photo}
                aria-label="Ler índice da foto"
                title="Ler índice da foto com OCR"
              >
                <ScanText size={18} />
                {ocrBusy ? 'Lendo…' : 'Ler da foto'}
              </button>
            </div>
            {(() => {
              const parsed = parseIndex(value);
              if (parsed !== null && prevIdx !== null && prevIdx !== undefined) {
                const diff = Math.round((parsed - prevIdx) * 1000) / 1000;
                const isNegative = diff < 0;
                const isHigh = diff > 30;
                return (
                  <div className={`iv-live-consumption ${isNegative || isHigh ? 'warn' : 'ok'}`}>
                    <span>
                      Consumo calculado: <strong className="mono">{diff >= 0 ? `+${diff}` : diff} m³</strong>
                      {isNegative && ' ⚠️ Regressão'}
                      {isHigh && ' ⚠️ Alto consumo'}
                      {!isNegative && !isHigh && ' ✅'}
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            {invalid && (
              <div className="iv-warn" role="alert">
                <AlertTriangle size={14} /> Índice inválido. Use apenas números, vírgula ou ponto.
              </div>
            )}
            {warnings.map((w) => (
              <div key={w.code} className="iv-warn" role="alert">
                <AlertTriangle size={14} /> {w.message}
              </div>
            ))}
            <div className="iv-nav">
              <button
                className="btn-ghost"
                onClick={handleBack}
                disabled={pos === 0}
                aria-label="Voltar para o índice anterior"
              >
                <ArrowLeft size={18} /> Voltar
              </button>
              <span className="iv-pos mono">
                {pos + 1}/{photoUnits.length}
              </span>
              <button
                className="btn-primary"
                onClick={() => void handleNext()}
                aria-label="Avançar para o próximo índice"
              >
                Avançar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <GlassCard className="empty-state">
          <ImageOff size={26} />
          <p>Nenhuma foto nesta torre. Capture as fotos primeiro.</p>
        </GlassCard>
      )}

      {zoomModal && apt && recordByApt.get(apt.aptCode)?.photo && (
        <div className="photo-lightbox" onClick={() => setZoomModal(false)}>
          <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="icon-btn glass photo-lightbox-close"
              onClick={() => setZoomModal(false)}
              aria-label="Fechar ampliação"
            >
              <X size={24} />
            </button>
            <AptPhoto blob={recordByApt.get(apt.aptCode)?.photo} aptCode={apt.aptCode} />
            <span className="photo-lightbox-badge mono">Apt {apt.aptCode} · Torre {towerId}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AptPhoto({ blob, aptCode }: { blob?: Blob | null; aptCode: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return <div className="iv-photo-placeholder" aria-label={`Foto ${aptCode}`} />;
  return <img src={url} alt={`Foto ${aptCode}`} className="iv-photo" />;
}
