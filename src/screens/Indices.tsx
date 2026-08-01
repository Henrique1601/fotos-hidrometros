import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Check, ImageOff } from 'lucide-react';
import { db } from '../db/db';
import { listTowerRecords, upsertRecord } from '../db/records';
import { floorSequence, towerById, UnitRef } from '../lib/towers';
import { campaignLabel, formatIndex, pad2, parseIndex, sideLabel } from '../lib/utils';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towerId]);

  useEffect(() => {
    if (!apt) {
      setValue('');
      return;
    }
    const idx = recordByApt.get(apt.aptCode)?.index;
    setValue(idx !== null && idx !== undefined ? formatIndex(idx) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apt?.aptCode, records]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [apt?.aptCode]);

  const save = useCallback(
    async (u: UnitRef, raw: string) => {
      const parsed = parseIndex(raw);
      if (parsed === null) return false;
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
      return true;
    },
    [campaignId, towerId],
  );

  const handleNext = useCallback(async () => {
    if (!apt) return;
    if (value.trim()) await save(apt, value);
    if (pos < photoUnits.length - 1) setPos(pos + 1);
  }, [apt, value, save, pos, photoUnits.length]);

  const handleBack = useCallback(() => {
    if (pos > 0) setPos(pos - 1);
  }, [pos]);

  const handleEnter = useCallback(async () => {
    if (!apt) return;
    const ok = await save(apt, value);
    if (!ok) return;
    if (pos < photoUnits.length - 1) setPos(pos + 1);
  }, [apt, value, save, pos, photoUnits.length]);

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
              className="iv-input"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Digite o índice"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleEnter();
              }}
              onBlur={() => {
                if (value.trim()) void save(apt, value);
              }}
              aria-label={`Índice do apartamento ${apt.aptCode}`}
            />
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
