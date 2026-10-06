import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageOff,
  Keyboard,
  Lock,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  ScanText,
  Search,
  Share2,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react';
import { db, MeterRecord } from '../db/db';
import { updateCampaign, upsertRecord } from '../db/records';
import { floorSequence, towerById, UnitRef } from '../lib/towers';
import { campaignLabel, formatIndex, pad2, parseIndex, sideLabel } from '../lib/utils';
import { mean, stddev, validateIndex } from '../lib/validate';
import type { IndexWarning } from '../lib/validate';
import { recognizeMeter } from '../lib/ocr';
import { useBgOcr } from '../lib/bgOcr';
import { selectPreviousCampaign } from '../lib/consumption';
import { shareVoucher } from '../lib/voucher';
import { rotateImageBlob } from '../lib/imageEdit';
import { playFocusFeedback } from '../lib/audioHaptics';
import GlassCard from '../components/GlassCard';
import ConfirmModal from '../components/ConfirmModal';
import ShortcutsModal from '../components/ShortcutsModal';
import { usePhotoUrl } from '../hooks/usePhotoUrl';
import { Screen } from '../nav';

type FilterMode = 'all' | 'pending' | 'alerts';

function unitHasAlert(record: MeterRecord | undefined, prevIdx: number | null | undefined): boolean {
  if (!record || record.index === null || record.index === undefined) return false;
  const idx = record.index;
  if (idx >= 50000) return true;
  if (prevIdx !== null && prevIdx !== undefined) {
    const diff = idx - prevIdx;
    if (diff < 0) return true;
    if (diff > 30) return true;
    if (prevIdx > 0 && idx > prevIdx * 2) return true;
  }
  return false;
}

interface Props {
  campaignId: number;
  go: (s: Screen) => void;
  toast: (m: string) => void;
}

export default function Indices({ campaignId, go, toast }: Props) {
  const [towerId, setTowerId] = useState('A');
  const [pos, setPos] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [value, setValue] = useState('');
  const [warnings, setWarnings] = useState<IndexWarning[]>([]);
  const [invalid, setInvalid] = useState(false);
  const [jump, setJump] = useState('');
  const [jumpMsg, setJumpMsg] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ aptCode: string; prevIndex: number | null; prevRaw: string } | null>(null);
  const [zoomModal, setZoomModal] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const bgOcr = useBgOcr(campaignId);
  const inputRef = useRef<HTMLInputElement>(null);

  const campaign = useLiveQuery(() => db.campaigns.get(campaignId), [campaignId]);
  const isLocked = campaign?.status === 'done';
  const tower = useMemo(() => towerById(towerId), [towerId]);
  const records =
    useLiveQuery(() => db.records.where('campaignId').equals(campaignId).toArray(), [campaignId]) ?? [];
  const towerRecords = useMemo(() => records.filter((r) => r.towerId === towerId), [records, towerId]);

  const recordByApt = useMemo(() => {
    const map = new Map<string, MeterRecord>();
    for (const r of towerRecords) {
      const existing = map.get(r.aptCode);
      if (!existing) {
        map.set(r.aptCode, r);
      } else {
        map.set(r.aptCode, {
          ...existing,
          ...r,
          photo: r.photo ?? existing.photo,
          index: r.index !== null && r.index !== undefined ? r.index : existing.index,
        });
      }
    }
    return map;
  }, [towerRecords]);

  const [prevIndexMap, setPrevIndexMap] = useState<Map<string, number | null>>(new Map());
  useEffect(() => {
    if (!campaign) return;
    async function loadPrev() {
      const allCampaigns = await db.campaigns.toArray();
      const prev = selectPreviousCampaign(allCampaigns, campaign!);
      if (!prev || !prev.id) {
        setPrevIndexMap(new Map());
        return;
      }
      const prevRecords = await db.records.where('campaignId').equals(prev.id).toArray();
      const map = new Map<string, number | null>();
      for (const r of prevRecords) {
        map.set(`${r.towerId}:${r.aptCode}`, r.index ?? null);
        if (r.towerId === towerId) {
          map.set(r.aptCode, r.index ?? null);
        }
      }
      setPrevIndexMap(map);
    }
    void loadPrev();
  }, [campaign, towerId]);

  const photoUnits = useMemo(
    () => floorSequence(tower).filter((u: UnitRef) => Boolean(recordByApt.get(u.aptCode)?.photo)),
    [tower, recordByApt],
  );

  const pendingUnits = useMemo(
    () =>
      photoUnits.filter((u: UnitRef) => {
        const idx = recordByApt.get(u.aptCode)?.index;
        return idx === null || idx === undefined;
      }),
    [photoUnits, recordByApt],
  );

  const alertUnits = useMemo(
    () =>
      photoUnits.filter((u: UnitRef) => {
        const rec = recordByApt.get(u.aptCode);
        const prev = prevIndexMap.get(u.aptCode);
        return unitHasAlert(rec, prev);
      }),
    [photoUnits, recordByApt, prevIndexMap],
  );

  const displayedUnits = useMemo(() => {
    if (filterMode === 'pending') return pendingUnits;
    if (filterMode === 'alerts') return alertUnits;
    return photoUnits;
  }, [filterMode, photoUnits, pendingUnits, alertUnits]);

  const apt = displayedUnits[pos];

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    const target = mode === 'pending' ? pendingUnits : mode === 'alerts' ? alertUnits : photoUnits;
    if (apt) {
      const idx = target.findIndex((u: UnitRef) => u.aptCode === apt.aptCode);
      setPos(idx >= 0 ? idx : 0);
    } else {
      setPos(0);
    }
  };

  const indexDone = useMemo(
    () =>
      photoUnits.filter((u: UnitRef) => {
        const idx = recordByApt.get(u.aptCode)?.index;
        return idx !== null && idx !== undefined;
      }).length,
    [photoUnits, recordByApt],
  );

  const pendingPhotosCount = useMemo(
    () => records.filter((r) => r.photo && (r.index === null || r.index === undefined)).length,
    [records],
  );

  useEffect(() => {
    if (pos >= displayedUnits.length && displayedUnits.length > 0) {
      setPos(displayedUnits.length - 1);
    }
  }, [pos, displayedUnits.length]);

  useEffect(() => {
    const target = filterMode === 'pending' ? pendingUnits : filterMode === 'alerts' ? alertUnits : photoUnits;
    const firstMissing = target.findIndex((u: UnitRef) => {
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

  const prevIdx = apt ? prevIndexMap.get(apt.aptCode) : null;

  const liveWarning = useMemo((): string | null => {
    if (!value.trim()) return null;
    const parsed = parseIndex(value);
    if (parsed === null) return null;

    if (prevIdx !== null && prevIdx !== undefined) {
      const diff = Math.round((parsed - prevIdx) * 1000) / 1000;
      if (diff < 0) {
        return `⚠️ O índice (${parsed}) é MENOR que o mês anterior (${formatIndex(prevIdx)}). Em hidrômetros o valor é acumulativo.`;
      }
      if (diff > 50) {
        return `🚨 ÍNDICE NÃO CONDIZ (MUITO ALTO): Consumo calculado de +${diff} m³! O consumo normal de um apartamento é até 30 m³. Verifique se não digitou dígitos a mais!`;
      }
      if (diff > 30) {
        return `⚠️ Atenção: Consumo de +${diff} m³ está acima do habitual para um apartamento (limite de 30 m³). Verifique se o índice está correto.`;
      }
      if (prevIdx > 0 && parsed > prevIdx * 2) {
        return `⚠️ Salto superior a 100% vs. o mês anterior (${formatIndex(prevIdx)} → ${parsed}). Confira a foto.`;
      }
    }

    if (parsed >= 50000) {
      return `⚠️ Índice muito alto (${parsed}). Verifique se não digitou os números vermelhos (litros) junto com os pretos (m³).`;
    }

    const cleanPeers = towerRecords
      .filter((r) => r.index !== null && r.index !== undefined && r.aptCode !== apt?.aptCode && r.index! > 0)
      .map((r) => r.index as number);

    if (cleanPeers.length >= 3) {
      const m = mean(cleanPeers);
      const s = stddev(cleanPeers);
      if (s > 0 && Math.abs(parsed - m) > 3 * s) {
        return `⚠️ Valor (${parsed}) muito fora da média dos outros apartamentos da Torre ${towerId} (${Math.round(m)}). Confira se digitou corretamente.`;
      }
    }

    return null;
  }, [value, prevIdx, towerRecords, apt?.aptCode, towerId]);

  const save = useCallback(
    async (u: UnitRef, raw: string): Promise<boolean> => {
      if (isLocked) {
        toast('Medição concluída e bloqueada. Reabra para editar.');
        return false;
      }
      try {
        const parsed = parseIndex(raw);
        if (parsed === null) {
          setInvalid(true);
          return false;
        }
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
        setWarnings(validateIndex(parsed, prevIdx ?? prev, peerList, { maxDiff: 30 }));
        setInvalid(false);
        return true;
      } catch (err) {
        console.error('Erro ao salvar índice:', err);
        toast('Erro ao salvar índice no banco de dados.');
        return false;
      }
    },
    [isLocked, campaignId, towerId, towerRecords, recordByApt, prevIdx, toast],
  );

  const handleUndo = useCallback(async () => {
    if (isLocked) {
      toast('Medição concluída e bloqueada. Reabra para editar.');
      return;
    }
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
  }, [isLocked, lastSaved, apt, campaignId, towerId, recordByApt, toast]);

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
    if (pos < displayedUnits.length - 1) {
      setPos(pos + 1);
    } else {
      toast(`Ap ${apt.aptCode} salvo! Fim das fotos desta lista.`);
    }
  }, [apt, value, save, pos, displayedUnits.length, toast]);

  const handleBack = useCallback(() => {
    if (pos > 0) setPos(pos - 1);
  }, [pos]);

  const handleEnter = useCallback(async () => {
    if (!apt) return;
    if (!canGo()) return;
    if (value.trim()) {
      if (!(await save(apt, value))) return;
    }
    if (pos < displayedUnits.length - 1) {
      setPos(pos + 1);
    } else {
      toast(`Ap ${apt.aptCode} salvo! Fim das fotos desta lista.`);
    }
  }, [apt, value, save, canGo, pos, displayedUnits.length, toast]);

  const handleJump = (e: FormEvent) => {
    e.preventDefault();
    const code = jump.trim();
    if (!code) return;
    const idx = displayedUnits.findIndex((u: UnitRef) => u.aptCode === code);
    if (idx >= 0) {
      setPos(idx);
      setJumpMsg(null);
      setShowSearch(false);
    } else {
      const existsInTower = photoUnits.some((u: UnitRef) => u.aptCode === code);
      if (existsInTower && filterMode !== 'all') {
        setFilterMode('all');
        const allIdx = photoUnits.findIndex((u: UnitRef) => u.aptCode === code);
        setPos(allIdx >= 0 ? allIdx : 0);
        setJumpMsg(null);
        setShowSearch(false);
      } else {
        setJumpMsg('Apt não encontrado nesta torre.');
      }
    }
  };

  const handleShareVoucher = useCallback(async () => {
    if (!apt || !campaign) return;
    const rec = recordByApt.get(apt.aptCode);
    const dateStr = rec?.capturedAt
      ? new Date(rec.capturedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : undefined;

    const res = await shareVoucher({
      towerId,
      aptCode: apt.aptCode,
      campaignLabel: campaignLabel(campaign.name, campaign.month, campaign.year),
      dateStr,
      previousIndex: prevIdx,
      currentIndex: rec?.index ?? (parseIndex(value) ?? null),
      photo: rec?.photo,
    });

    if (res.shared) {
      toast(res.via === 'whatsapp' ? 'WhatsApp aberto com comprovante!' : 'Comprovante compartilhado!');
    }
  }, [apt, campaign, recordByApt, towerId, prevIdx, value, toast]);

  const handleReadPhoto = async () => {
    if (isLocked) {
      toast('Medição concluída e bloqueada. Reabra para editar.');
      return;
    }
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

  const handleRotate = useCallback(
    async (degrees: number = 90) => {
      if (isLocked) {
        toast('Medição concluída e bloqueada. Reabra para editar.');
        return;
      }
      if (!apt) return;
      const rec = recordByApt.get(apt.aptCode);
      if (!rec?.photo) {
        toast('Sem foto cadastrada para este hidrômetro.');
        return;
      }
      if (rotating) return;

      setRotating(true);
      try {
        playFocusFeedback();
        const rotated = await rotateImageBlob(rec.photo, degrees);
        await upsertRecord({
          campaignId,
          towerId,
          floor: apt.floor,
          unit: apt.unit,
          side: apt.side,
          aptCode: apt.aptCode,
          photo: rotated,
        });
        toast(degrees === 90 ? 'Foto girada 90° e salva.' : `Foto girada ${degrees}° e salva.`);
      } catch (err) {
        console.error('Erro ao girar foto:', err);
        toast('Erro ao girar a foto.');
      } finally {
        setRotating(false);
      }
    },
    [isLocked, apt, recordByApt, rotating, campaignId, towerId, toast],
  );

  const handleLightboxNext = useCallback(() => {
    if (pos < displayedUnits.length - 1) {
      setPos((prev) => prev + 1);
    } else {
      toast('Fim das fotos desta lista.');
    }
  }, [pos, displayedUnits.length, toast]);

  const handleLightboxBack = useCallback(() => {
    if (pos > 0) setPos((prev) => prev - 1);
  }, [pos]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isSearchInput = target?.getAttribute('aria-label') === 'Buscar apartamento';
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      // 1. ESCAPE: fecha modais ou remove foco
      if (e.key === 'Escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          e.preventDefault();
          return;
        }
        if (zoomModal) {
          setZoomModal(false);
          e.preventDefault();
          return;
        }
        if (showSearch) {
          setShowSearch(false);
          e.preventDefault();
          return;
        }
        if (isTextInput) {
          target?.blur();
          e.preventDefault();
          return;
        }
      }

      // 2. GUIA DE ATALHOS: ? ou F1 (quando não digitando em input)
      if ((e.key === '?' || e.key === 'F1') && !isTextInput) {
        setShortcutsOpen((prev) => !prev);
        e.preventDefault();
        return;
      }

      // 3. ZOOM LIGHTBOX: Z ou Espaço (quando não digitando em input)
      if (!isTextInput && (e.key === 'z' || e.key === 'Z' || e.key === ' ') && !e.ctrlKey && !e.metaKey) {
        if (recordByApt.get(apt?.aptCode ?? '')?.photo) {
          setZoomModal((prev) => !prev);
          e.preventDefault();
          return;
        }
      }

      // 4. DESFAZER: Ctrl+Z ou Alt+Z
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey || e.altKey)) {
        if (lastSaved && apt && lastSaved.aptCode === apt.aptCode) {
          e.preventDefault();
          void handleUndo();
          return;
        }
      }

      // 5. OCR: Alt+O ou (O quando fora de input)
      if ((e.key === 'o' || e.key === 'O') && (e.altKey || !isTextInput)) {
        e.preventDefault();
        void handleReadPhoto();
        return;
      }

      // 5.1 GIRAR FOTO: Alt+R ou (R quando fora de input ou em Lightbox)
      if ((e.key === 'r' || e.key === 'R') && (e.altKey || !isTextInput || zoomModal)) {
        e.preventDefault();
        const angle = e.shiftKey ? -90 : 90;
        void handleRotate(angle);
        return;
      }

      // 6. BUSCA: / ou Ctrl+F
      if ((e.key === '/' || ((e.key === 'f' || e.key === 'F') && (e.ctrlKey || e.metaKey))) && !isSearchInput) {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // 7. TROCA DE TORRES: [ e ] (quando fora de input)
      if ((e.key === '[' || e.key === ']') && !isTextInput) {
        const towerIds = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const curIdx = towerIds.indexOf(towerId);
        if (e.key === '[' && curIdx > 0) {
          setTowerId(towerIds[curIdx - 1]);
          e.preventDefault();
        } else if (e.key === ']' && curIdx < towerIds.length - 1) {
          setTowerId(towerIds[curIdx + 1]);
          e.preventDefault();
        }
        return;
      }

      // 8. NAVEGAÇÃO DE FOTOS NO MODO LIGHTBOX
      if (zoomModal) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'd' || e.key === 'D' || e.key === ' ') {
          e.preventDefault();
          handleLightboxNext();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleLightboxBack();
          return;
        }
        return;
      }

      // 9. NAVEGAÇÃO GERAL (FORA DO LIGHTBOX)
      // PageDown e PageUp sempre navegam entre fotos
      if (e.key === 'PageDown') {
        e.preventDefault();
        void handleNext();
        return;
      }
      if (e.key === 'PageUp') {
        e.preventDefault();
        handleBack();
        return;
      }

      // Alt + Setas navegam sempre
      if (e.altKey) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          void handleNext();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          handleBack();
          return;
        }
      }

      // Quando o foco NÃO está em campo de texto:
      if (!isTextInput) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          void handleNext();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          handleBack();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          inputRef.current?.focus();
          return;
        }
        // Se usuário digita número ou vírgula/ponto enquanto confere fotos: foca no campo
        if (/^[0-9,.]$/.test(e.key)) {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    shortcutsOpen,
    zoomModal,
    showSearch,
    pos,
    photoUnits.length,
    apt,
    towerId,
    handleNext,
    handleBack,
    handleLightboxNext,
    handleLightboxBack,
    handleUndo,
    handleReadPhoto,
    handleRotate,
    lastSaved,
    recordByApt,
  ]);

  const parsedCurrent = parseIndex(value);

  return (
    <div className="indices-screen">
      <header className="app-header">
        <button className="icon-btn glass" onClick={() => go({ name: 'home' })} aria-label="Voltar">
          <ArrowLeft size={22} />
        </button>
        <div className="header-center">
          <h2 className="header-title">
            {campaign ? campaignLabel(campaign.name, campaign.month, campaign.year) : ''}
          </h2>
          <span className="header-sub">
            Torre {towerId} · Índices {indexDone}/{photoUnits.length}
          </span>
        </div>
        <div className="iv-header-actions">
          <button
            className="icon-btn glass"
            onClick={() => setShortcutsOpen(true)}
            aria-label="Atalhos de teclado (?)"
            title="Atalhos de teclado (?)"
          >
            <Keyboard size={18} />
          </button>
          <button
            className={`icon-btn glass${showSearch ? ' is-active' : ''}`}
            onClick={() => setShowSearch((prev) => !prev)}
            aria-label="Buscar apartamento (/)"
            title="Buscar apartamento (/)"
          >
            <Search size={18} />
          </button>
        </div>
      </header>

      {isLocked && (
        <div className="campaign-locked-banner gs-home-item">
          <div className="campaign-locked-info">
            <Lock size={16} />
            <span>Medição Concluída (Bloqueada) · Modo somente leitura</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => setUnlockModalOpen(true)}>
            Reabrir
          </button>
        </div>
      )}

      <div className="chip-row indices-tower-chips">
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

      <div className="indices-filter-bar">
        <button
          type="button"
          className={`filter-chip${filterMode === 'all' ? ' is-active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          Todos <span className="chip-count">{photoUnits.length}</span>
        </button>
        <button
          type="button"
          className={`filter-chip${filterMode === 'pending' ? ' is-active' : ''}`}
          onClick={() => handleFilterChange('pending')}
        >
          Pendentes <span className="chip-count">{pendingUnits.length}</span>
        </button>
        <button
          type="button"
          className={`filter-chip${filterMode === 'alerts' ? ' is-active' : ''}${alertUnits.length > 0 ? ' has-alerts' : ''}`}
          onClick={() => handleFilterChange('alerts')}
        >
          Com Alerta <span className="chip-count">{alertUnits.length}</span>
        </button>
      </div>

      {showSearch && (
        <form className="apt-jump" onSubmit={handleJump} role="search">
          <Search size={16} aria-hidden="true" />
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            placeholder="Ir para apt (ex.: 258)"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-label="Buscar apartamento"
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowSearch(false)}
            aria-label="Fechar busca"
          >
            <X size={16} />
          </button>
          {jumpMsg && <span className="apt-jump-msg">{jumpMsg}</span>}
        </form>
      )}

      {pendingPhotosCount > 0 && !isLocked && (
        <div className="bg-ocr-banner compact">
          <div className="bg-ocr-info">
            <Sparkles size={14} className={`bg-ocr-icon${bgOcr.isRunning ? ' spin' : ''}`} />
            <div>
              <p className="bg-ocr-sub">
                {bgOcr.isRunning
                  ? `OCR: ${bgOcr.currentApt ? `Ap ${bgOcr.currentApt}` : ''} (${bgOcr.processed}/${bgOcr.total})`
                  : bgOcr.successCount > 0
                  ? `${bgOcr.successCount} índices lidos`
                  : `${pendingPhotosCount} fotos pendentes`}
              </p>
            </div>
          </div>
          <button
            className={`btn-sm ${bgOcr.isRunning ? 'btn-ghost' : 'btn-primary'}`}
            onClick={() => (bgOcr.isRunning ? bgOcr.stop() : bgOcr.start(campaignId))}
            aria-label={bgOcr.isRunning ? 'Pausar OCR' : 'Processar fotos com OCR'}
          >
            {bgOcr.isRunning ? <Pause size={12} /> : <Play size={12} />}
            {bgOcr.isRunning ? 'Pausar' : 'Ler todas'}
          </button>
        </div>
      )}


      {apt ? (
        <div className="iv iv-focus-mode">
          {/* FOTO PRINCIPAL COM ZOOM DINÂMICO NO MOUSE */}
          <div className="iv-photo-wrap">
            <AptPhoto
              blob={recordByApt.get(apt.aptCode)?.photo}
              aptCode={apt.aptCode}
              onClick={() => setZoomModal(true)}
            />

            <span className="iv-badge mono">{apt.aptCode}</span>

            <span className="iv-meta">
              Andar {pad2(apt.floor)} · {sideLabel(apt.side)}
            </span>

            {/* GRUPO SUPERIOR DIREITO: ÍNDICE ANTERIOR EM DESTAQUE + STATUS SALVO */}
            <div className="iv-top-right-group">
              {prevIdx !== null && prevIdx !== undefined ? (
                <span className="iv-prev-overlay-badge" title="Índice do mês anterior de referência">
                  <Clock size={12} className="iv-prev-overlay-icon" />
                  <span className="iv-prev-overlay-sub">Ant:</span>
                  <strong className="mono">{formatIndex(prevIdx)}</strong>
                </span>
              ) : (
                <span className="iv-prev-overlay-badge dim" title="Sem índice anterior cadastrado">
                  <Clock size={12} className="iv-prev-overlay-icon" />
                  <span className="iv-prev-overlay-sub">Sem anterior</span>
                </span>
              )}

              {recordByApt.get(apt.aptCode)?.index !== null &&
                recordByApt.get(apt.aptCode)?.index !== undefined && (
                  <span className="iv-filled">
                    <Check size={12} /> Salvo
                    {lastSaved && lastSaved.aptCode === apt.aptCode && (
                      <button
                        className="iv-undo"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleUndo();
                        }}
                        aria-label="Desfazer índice"
                        title="Desfazer"
                      >
                        <Undo2 size={12} />
                      </button>
                    )}
                  </span>
                )}
            </div>

            {recordByApt.get(apt.aptCode)?.photo && (
              <div className="iv-photo-actions">
                <button
                  type="button"
                  className="iv-rotate-btn glass"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleRotate(90);
                  }}
                  disabled={isLocked || rotating}
                  aria-label="Girar foto 90° horário (R)"
                  title="Girar foto 90° horário (R)"
                >
                  <RotateCw size={14} className={rotating ? 'spin' : ''} />
                  <span>Girar 90°</span>
                </button>
              </div>
            )}
          </div>

          {/* PAINEL INFERIOR COMPACTO E FOCADO NA DIGITAÇÃO */}
          <div className="iv-panel">
            {prevIdx !== null && prevIdx !== undefined && (
              <div className="iv-prev">
                <Clock size={14} />
                <span>
                  Índice anterior: <strong className="mono">{formatIndex(prevIdx)}</strong>
                </span>
              </div>
            )}

            <div className="iv-input-row">
              <input
                id="iv-input"
                ref={inputRef}
                className={`iv-input${invalid || liveWarning ? ' iv-input-invalid' : ''}`}
                inputMode="decimal"
                autoComplete="off"
                disabled={isLocked}
                placeholder={isLocked ? 'Medição concluída (bloqueada)' : 'Digite o índice'}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setInvalid(false);
                  setWarnings([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleEnter();
                  if (e.key === 'ArrowLeft' && e.altKey) handleBack();
                  if (e.key === 'ArrowRight' && e.altKey) void handleNext();
                }}
                onBlur={() => {
                  if (value.trim() && parseIndex(value) !== null) void save(apt, value);
                }}
                aria-label={`Índice do apartamento ${apt.aptCode}`}
              />
              <button
                className="ocr-btn"
                onClick={() => void handleReadPhoto()}
                disabled={isLocked || ocrBusy || !recordByApt.get(apt.aptCode)?.photo}
                aria-label="Ler índice da foto"
                title={isLocked ? 'Medição bloqueada' : 'Ler índice da foto com OCR'}
              >
                <ScanText size={18} />
                {ocrBusy ? 'Lendo…' : 'OCR'}
              </button>
            </div>

            {/* ALERTA VISÍVEL EM TEMPO REAL QUANDO O VALOR NÃO CONDIZ */}
            {liveWarning && (
              <div className="iv-high-alert" role="alert">
                <AlertTriangle size={18} className="iv-alert-icon" />
                <span>{liveWarning}</span>
              </div>
            )}

            {/* CONSUMO NORMAL CALCULADO AO VIVO */}
            {parsedCurrent !== null &&
              prevIdx !== null &&
              prevIdx !== undefined &&
              !liveWarning && (
                <div className="iv-live-consumption ok">
                  <span>
                    Consumo calculado:{' '}
                    <strong className="mono">
                      +{Math.round((parsedCurrent - prevIdx) * 1000) / 1000} m³
                    </strong>{' '}
                    ✅
                  </span>
                </div>
              )}

            {invalid && (
              <div className="iv-warn" role="alert">
                <AlertTriangle size={14} /> Índice inválido. Use apenas números, vírgula ou ponto.
              </div>
            )}

            {warnings.map((w) => (
              <div
                key={w.code}
                className={w.code === 'excessive_consumption' || w.code === 'unrealistic_value' ? 'iv-high-alert' : 'iv-warn'}
                role="alert"
              >
                <AlertTriangle size={14} /> {w.message}
              </div>
            ))}

            <div className="iv-nav">
              <button
                className="btn-ghost"
                onClick={handleBack}
                disabled={pos === 0}
                aria-label="Voltar para a foto anterior (←, PgUp ou Alt+←)"
                title="Voltar foto (←, PgUp ou Alt+←)"
              >
                <ArrowLeft size={18} /> Voltar
              </button>

              <button
                type="button"
                className="btn-ghost btn-voucher"
                onClick={() => void handleShareVoucher()}
                aria-label="Enviar comprovante via WhatsApp"
                title="Compartilhar comprovante / WhatsApp"
              >
                <Share2 size={15} />
                <span className="btn-voucher-label">WhatsApp</span>
              </button>

              <span className="iv-pos mono">
                {pos + 1}/{displayedUnits.length}
              </span>
              <button
                className="btn-primary"
                onClick={() => void handleNext()}
                aria-label="Avançar para a próxima foto (Enter, →, PgDn ou Alt+→)"
                title="Avançar foto (Enter, →, PgDn ou Alt+→)"
              >
                Avançar <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : photoUnits.length === 0 ? (
        <GlassCard className="empty-state">
          <ImageOff size={26} />
          <p>Nenhuma foto nesta torre. Capture as fotos primeiro.</p>
        </GlassCard>
      ) : filterMode === 'pending' ? (
        <GlassCard className="empty-state">
          <CheckCircle2 size={32} style={{ color: 'var(--teal)' }} />
          <p style={{ fontWeight: 600, color: 'var(--text)', margin: '8px 0 4px' }}>Tudo preenchido!</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            Todos os {photoUnits.length} índices da Torre {towerId} já foram digitados.
          </p>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => handleFilterChange('all')}
          >
            Ver todos
          </button>
        </GlassCard>
      ) : (
        <GlassCard className="empty-state">
          <CheckCircle2 size={32} style={{ color: 'var(--teal)' }} />
          <p style={{ fontWeight: 600, color: 'var(--text)', margin: '8px 0 4px' }}>Sem alertas</p>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>
            Nenhum apartamento com anomalia ou regressão na Torre {towerId}.
          </p>
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => handleFilterChange('all')}
          >
            Ver todos
          </button>
        </GlassCard>
      )}

      {zoomModal && apt && recordByApt.get(apt.aptCode)?.photo && (
        <div className="photo-lightbox" onClick={() => setZoomModal(false)}>
          <div className="photo-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="photo-lightbox-actions">
              <button
                type="button"
                className="icon-btn glass photo-lightbox-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRotate(-90);
                }}
                disabled={isLocked || rotating}
                aria-label="Girar 90° anti-horário (Shift+R)"
                title="Girar 90° anti-horário (Shift+R)"
              >
                <RotateCcw size={20} className={rotating ? 'spin' : ''} />
              </button>
              <button
                type="button"
                className="icon-btn glass photo-lightbox-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRotate(90);
                }}
                disabled={isLocked || rotating}
                aria-label="Girar 90° horário (R)"
                title="Girar 90° horário (R)"
              >
                <RotateCw size={20} className={rotating ? 'spin' : ''} />
              </button>
              <button
                type="button"
                className="icon-btn glass photo-lightbox-close"
                onClick={() => setZoomModal(false)}
                aria-label="Fechar ampliação (Esc ou Z)"
                title="Fechar (Esc ou Z)"
              >
                <X size={24} />
              </button>
            </div>

            {pos > 0 && (
              <button
                className="icon-btn glass photo-lightbox-nav prev"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLightboxBack();
                }}
                aria-label="Foto anterior (← ou A)"
                title="Foto anterior (← ou A)"
              >
                <ChevronLeft size={28} />
              </button>
            )}

            <LightboxPhoto blob={recordByApt.get(apt.aptCode)?.photo} aptCode={apt.aptCode} />

            {pos < displayedUnits.length - 1 && (
              <button
                className="icon-btn glass photo-lightbox-nav next"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLightboxNext();
                }}
                aria-label="Próxima foto (→ ou D)"
                title="Próxima foto (→ ou D)"
              >
                <ChevronRight size={28} />
              </button>
            )}

            <span className="photo-lightbox-badge mono">
              Apt {apt.aptCode} · Torre {towerId} ({pos + 1}/{displayedUnits.length})
              {prevIdx !== null && prevIdx !== undefined ? ` · Ant: ${formatIndex(prevIdx)}` : ''}
            </span>

            <span className="photo-lightbox-hint">
              Navegar: ← → ou A/D · Girar: R / Shift+R · Fechar: Esc ou Z
            </span>
          </div>
        </div>
      )}

      <ConfirmModal
        open={unlockModalOpen}
        title="Reabrir medição?"
        message="Deseja reabrir esta medição para edição? Você poderá alterar índices e capturar fotos novamente."
        confirmLabel="Reabrir"
        onConfirm={async () => {
          await updateCampaign(campaignId, { status: 'collecting' });
          toast('Medição reaberta para edição.');
          setUnlockModalOpen(false);
        }}
        onCancel={() => setUnlockModalOpen(false)}
      />

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

interface AptPhotoProps {
  blob?: Blob | null;
  aptCode: string;
  onClick?: () => void;
}

function AptPhoto({ blob, aptCode, onClick }: AptPhotoProps) {
  const url = usePhotoUrl(blob);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [coords, setCoords] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 50, y: 50 });
  };

  if (!url) return <div className="iv-photo-placeholder" aria-label={`Foto ${aptCode}`} />;

  return (
    <div
      ref={containerRef}
      className={`iv-photo-container${isHovered ? ' is-zooming' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <img
        src={url}
        alt={`Foto ${aptCode}`}
        className="iv-photo iv-photo-zoomable"
        style={{
          transformOrigin: `${coords.x}% ${coords.y}%`,
          transform: isHovered ? 'scale(2.3)' : 'scale(1)',
        }}
      />
      {isHovered ? (
        <span className="iv-zoom-active-badge">
          🔍 Lupa 2.3× ativa
        </span>
      ) : (
        <span className="iv-zoom-hint">
          <Maximize2 size={12} /> Passe o mouse p/ zoom
        </span>
      )}
    </div>
  );
}

function LightboxPhoto({ blob, aptCode }: { blob?: Blob | null; aptCode: string }) {
  const url = usePhotoUrl(blob);
  if (!url) return <div className="iv-photo-placeholder" aria-label={`Foto ${aptCode}`} />;
  return <img src={url} alt={`Foto ${aptCode}`} className="iv-photo" />;
}
