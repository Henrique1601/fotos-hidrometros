import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, Check } from 'lucide-react';
import { db } from '../db/db';
import { listTowerRecords, upsertRecord } from '../db/records';
import { towerById, UnitRef } from '../lib/towers';
import { campaignLabel, formatIndex, parseIndex } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { Screen } from '../nav';

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
}

export default function Indices({ campaignId, go }: Props) {
  const [towerId, setTowerId] = useState('A');
  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const tower = useMemo(() => towerById(towerId), [towerId]);
  const records =
    useLiveQuery(() => listTowerRecords(campaignId, towerId), [campaignId, towerId]) ?? [];

  const units = useMemo<UnitRef[]>(
    () =>
      tower.floors.flatMap((f) =>
        f.units.map((u) => ({
          floor: f.floor,
          unit: u,
          aptCode: `${f.floor * 10 + u}`,
          side: (u >= 3 && u <= 6 ? 'left' : 'right') as 'left' | 'right',
        })),
      ),
    [tower],
  );

  const recordByApt = useMemo(() => new Map(records.map((r) => [r.aptCode, r])), [records]);

  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of records) {
      if (r.index !== null && r.index !== undefined) next[r.aptCode] = formatIndex(r.index);
    }
    setValues(next);
  }, [towerId, records]);

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const indexDone = useMemo(
    () => units.filter((u) => recordByApt.get(u.aptCode)?.index !== null && recordByApt.get(u.aptCode)?.index !== undefined).length,
    [units, recordByApt],
  );

  const save = useCallback(
    async (apt: UnitRef, raw: string) => {
      const parsed = parseIndex(raw);
      if (parsed === null) return false;
      await upsertRecord({
        campaignId,
        towerId,
        floor: apt.floor,
        unit: apt.unit,
        side: apt.side,
        aptCode: apt.aptCode,
        index: parsed,
        indexedAt: Date.now(),
      });
      return true;
    },
    [campaignId, towerId],
  );

  useGSAP(
    () => {
      gsap.fromTo('.gs-index-row', { opacity: 0, x: -12 }, { opacity: 1, x: 0, stagger: 0.02, duration: 0.3, ease: 'power2.out' });
      const firstMissing = units.find(
        (u) => recordByApt.get(u.aptCode)?.photo && (recordByApt.get(u.aptCode)?.index === null || recordByApt.get(u.aptCode)?.index === undefined),
      );
      const el = firstMissing ? inputRefs.current[firstMissing.aptCode] : null;
      if (el) el.focus();
    },
    { dependencies: [towerId, records] },
  );

  const handleKeyDown = async (apt: UnitRef, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const ok = await save(apt, (e.target as HTMLInputElement).value);
    if (!ok) return;
    const idx = units.findIndex((u) => u.aptCode === apt.aptCode);
    const next = units[idx + 1];
    if (next) inputRefs.current[next.aptCode]?.focus();
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
            Índices {indexDone}/{units.length}
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

      <GlassCard className="indices-card">
        <p className="hint">
          Digite o índice da foto. Enter avança para o próximo.
        </p>
        <ul className="index-list">
          {units.map((u) => {
            const rec = recordByApt.get(u.aptCode);
            const hasPhoto = Boolean(rec?.photo);
            const filled = rec?.index !== null && rec?.index !== undefined;
            return (
              <li key={u.aptCode} className="index-row gs-index-row">
                <div className="index-apt">
                  <span className="index-thumb">
                    <AptThumb photo={rec?.photo ?? undefined} />
                  </span>
                  <span className="index-code">
                    {u.aptCode}
                    <small className="index-side">
                      {u.floor}º · {u.side === 'left' ? 'Esq' : 'Dir'}
                    </small>
                  </span>
                </div>
                <input
                  ref={(el) => {
                    inputRefs.current[u.aptCode] = el;
                  }}
                  className={`index-input${filled ? ' index-filled' : ''}`}
                  inputMode="numeric"
                  autoComplete="off"
                  disabled={!hasPhoto}
                  placeholder={hasPhoto ? '—' : 'sem foto'}
                  value={values[u.aptCode] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [u.aptCode]: e.target.value }))}
                  onBlur={(e) => void save(u, e.target.value)}
                  onKeyDown={(e) => void handleKeyDown(u, e)}
                  aria-label={`Índice do apartamento ${u.aptCode}`}
                />
                {filled && <Check size={16} className="index-ok" />}
              </li>
            );
          })}
        </ul>
      </GlassCard>
    </div>
  );
}

function AptThumb({ photo }: { photo?: Blob }) {
  const url = usePhotoUrl(photo);
  if (!url) return null;
  return <img src={url} alt="" loading="lazy" />;
}
