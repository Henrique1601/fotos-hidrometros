import { useMemo, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowLeft, Building2 } from 'lucide-react';
import { db } from '../db/db';
import { TOWERS } from '../lib/towers';
import { MONTHS } from '../lib/utils';
import GlassCard from '../components/GlassCard';
import { Screen } from '../nav';

interface Props {
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function NewCampaign({ go, toast }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [name, setName] = useState('');

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  useGSAP(() => {
    gsap.fromTo('.gs-new-item', { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.06, duration: 0.45, ease: 'power2.out' });
  }, []);

  const handleSelectTower = async (towerId: string) => {
    const nowTs = Date.now();
    const id = await db.campaigns.add({
      name: name.trim() || undefined,
      month,
      year,
      createdAt: nowTs,
      updatedAt: nowTs,
      status: 'collecting',
    });
    toast('Medição criada! Escolha a torre para fotografar.');
    go({ name: 'collect', campaignId: id, towerId });
  };

  return (
    <div>
      <header className="app-header">
        <button className="icon-btn glass gs-new-item" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <h2 className="header-title gs-new-item">Nova medição</h2>
        <span className="header-spacer" />
      </header>

      <GlassCard className="form-card gs-new-item">
        <label className="field-label">Nome (opcional)</label>
        <input
          className="text-input"
          placeholder={`${MONTHS[month - 1]} ${year}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Nome da medição"
        />

        <div className="field-row">
          <div className="field-half">
            <label className="field-label">Mês</label>
            <select className="text-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="field-half">
            <label className="field-label">Ano</label>
            <select className="text-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      <p className="tower-hint gs-new-item">Escolha a torre para começar:</p>
      <div className="tower-grid">
        {TOWERS.map((t) => (
          <button key={t.id} className="tower-tile glass gs-new-item" onClick={() => handleSelectTower(t.id)}>
            <Building2 size={24} />
            <span className="tower-letter">{t.id}</span>
            <span className="tower-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
