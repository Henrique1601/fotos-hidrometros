import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ImageOff, Search } from 'lucide-react';
import { db } from '../db/db';
import { listTowerRecords, upsertRecord } from '../db/records';
import { floorSequence, towerById, UnitRef } from '../lib/towers';
import { campaignLabel, formatIndex, pad2, parseIndex, sideLabel } from '../lib/utils';
import { IndexWarning, validateIndex } from '../lib/validate';
import GlassCard from '../components/GlassCard';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { Screen } from '../nav';

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
}

export default function Indices({ campaignId, go }: Props) {
  const [towerId, setTowerId] = useState('A');
  const [pos, setPos] = useState(0);
  const [value, setValue] = useState('');
  const [warnings, setWarnings] = useState<IndexWarning[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [jump, setJump] = useState('');
  const [jumpMsg, setJumpMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const tower = useMemo(() => towerById(towerId), [towerId]);
  const records =
    useLiveQuery(() => listTowerRecords(campaignId, towerId), [campaignId, towerId]) ?? [];

  const recordByApt = useMemo(() => new Map(records.map((r) => [r.aptCode, r])), [records]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apt?.aptCode, records]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [apt?.aptCode]);

  const save = useCallback(
    async (u: UnitRef, raw: string): Promise<boolean> => {
      const parsed = parseIndex(raw);
      if (parsed === null) return false;
      const prev = recordByApt.get(u.aptCode)?.index;
      const peerList = records
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
      setWarnings(validateIndex(parsed, prev, peerList));
      setInvalid(false);
      return true;
    },
    [campaignId, towerId, records, recordByApt],
  );

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
          <div className="iv-photo-wrap">
            <AptPhoto blob={recordByApt.get(apt.aptCode)?.photo} aptCode={apt.aptCode} />
            <span className="iv-badge mono">{apt.aptCode}</span>
            <span className="iv-meta">
              Andar {pad2(apt.floor)} · {sideLabel(apt.side)}
            </span>
            {recordByApt.get(apt.aptCode)?.index !== null &&
              recordByApt.get(apt.aptCode)?.index !== undefined && (
                <span className="iv-filled">
                  <Check size={12} /> Salvo
                </span>
              )}
          </div>

          <div className="iv-panel">
            <label className="field-label" htmlFor="iv-input">
              Índice do hidrômetro
            </label>
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
    </div>
  );
}

function AptPhoto({ blob, aptCode }: { blob?: Blob | null; aptCode: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return <div className="iv-photo-placeholder" aria-label={`Foto ${aptCode}`} />;
  return <img src={url} alt={`Foto ${aptCode}`} className="iv-photo" />;
}
