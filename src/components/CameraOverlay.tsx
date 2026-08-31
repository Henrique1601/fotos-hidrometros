import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Layers, Minus, Plus, RotateCcw, ScanText, Undo2, Upload, X, Zap, ZapOff } from 'lucide-react';
import {
  ActiveCamera,
  CameraCapabilities,
  captureFrame,
  setTorch,
  setZoom,
  startCamera,
  stopCamera,
} from '../lib/camera';
import { recognizeMeter, OcrResult } from '../lib/ocr';
import { watermarkPhoto, formatWatermarkDate } from '../lib/watermark';
import { upsertRecord } from '../db/records';
import { pad2 } from '../lib/utils';
import { UnitRef } from '../lib/towers';

interface Props {
  campaignId: number;
  towerId: string;
  apt: UnitRef;
  onPrev?: () => void;
  onSaved: (ocrIndex?: number) => void;
  onClose: () => void;
  toast?: (msg: string) => void;
}

type Phase = 'opening' | 'live' | 'preview' | 'error';

export default function CameraOverlay({ campaignId, towerId, apt, onPrev, onSaved, onClose, toast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<ActiveCamera | null>(null);
  const startedRef = useRef(false);
  const photoTakenRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('opening');
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [flash, setFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [torchOn, setTorchOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foto-hidro:torch') === 'true';
    } catch {
      return false;
    }
  });
  const [torchSupported, setTorchSupported] = useState(false);

  const [burstMode, setBurstMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foto-hidro:burst') === 'true';
    } catch {
      return false;
    }
  });

  const [saving, setSaving] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [zoomCaps, setZoomCaps] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomSupported, setZoomSupported] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  const pinches = useRef<{ start: number; startZoom: number } | null>(null);

  const stop = useCallback(() => {
    stopCamera(camRef.current?.stream ?? null);
    camRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    setPhase('opening');
    setErrorMsg('');
    try {
      if (!videoRef.current) throw new Error('Câmera não disponível');
      const cam = await startCamera(videoRef.current);
      if (photoTakenRef.current) {
        stopCamera(cam.stream);
        return;
      }
      camRef.current = cam;
      setTorchSupported(cam.caps.torchSupported);
      setZoomSupported(cam.caps.zoomSupported);
      setZoomCaps({ min: cam.caps.zoomMin, max: cam.caps.zoomMax, step: cam.caps.zoomStep });
      setZoomState(cam.caps.zoomMin);

      if (cam.caps.torchSupported && torchOn) {
        void setTorch(cam, true);
      }

      setPhase('live');
    } catch (e) {
      if (photoTakenRef.current) return;
      console.warn('Câmera indisponível, usando arquivo', e);
      setErrorMsg('Não foi possível abrir a câmera integrada. Use a câmera nativa tocando abaixo.');
      setPhase('error');
    }
  }, [torchOn]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    return () => {
      stop();
      startedRef.current = false;
    };
  }, [start, stop]);

  useEffect(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setBlob(null);
    photoTakenRef.current = false;
    if (camRef.current && phase !== 'error') {
      setPhase('live');
      if (torchOn && camRef.current.caps.torchSupported) {
        void setTorch(camRef.current, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apt.aptCode]);

  const downloadWatermarked = useCallback(async (photoBlob: Blob) => {
    try {
      const ts = Date.now();
      const text = `Torre ${towerId} · Apt ${apt.aptCode} · Andar ${pad2(apt.floor)} · ${formatWatermarkDate(ts)}`;
      const watermarked = await watermarkPhoto(photoBlob, text);
      const url = URL.createObjectURL(watermarked);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Torre${towerId}-apt${apt.aptCode}-${ts}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Download marca d\'água falhou:', e);
    }
  }, [towerId, apt]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || saving) return;
    try {
      setFlash(true);
      navigator.vibrate?.(50);
      setTimeout(() => setFlash(false), 220);

      const b = await captureFrame(videoRef.current);

      if (burstMode) {
        setSaving(true);
        try {
          await upsertRecord({
            campaignId,
            towerId,
            floor: apt.floor,
            unit: apt.unit,
            side: apt.side,
            aptCode: apt.aptCode,
            photo: b,
            capturedAt: Date.now(),
          });
          onSaved();
        } finally {
          setSaving(false);
        }
      } else {
        photoTakenRef.current = true;
        setBlob(b);
        stop();
        const url = URL.createObjectURL(b);
        setPreview(url);
        setPhase('preview');
        void downloadWatermarked(b);
        setOcrBusy(true);
        recognizeMeter(b)
          .then((r) => {
            if (r.value !== null) {
              setOcr(r);
              toast?.(`OCR detectou: ${formatOcrValue(r.value)}`);
            } else {
              toast?.('Não li o índice. Preencha manualmente.');
            }
          })
          .catch((e) => {
            console.warn('OCR erro:', e);
            toast?.('OCR indisponível. Preencha manualmente.');
          })
          .finally(() => setOcrBusy(false));
      }
    } catch (e) {
      console.error('Falha ao capturar a imagem:', e);
      setErrorMsg('Falha ao capturar a imagem.');
      setPhase('error');
    }
  }, [burstMode, campaignId, towerId, apt, onSaved, stop, saving, downloadWatermarked, toast]);

  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    photoTakenRef.current = false;
    setPreview(null);
    setBlob(null);
    setOcr(null);
    setOcrBusy(false);
    void start();
  }, [preview, start]);

  const toggleTorch = useCallback(async () => {
    const cam = camRef.current;
    const next = !torchOn;
    setTorchOn(next);
    try {
      localStorage.setItem('foto-hidro:torch', String(next));
    } catch {
      // ignore
    }
    if (cam) {
      await setTorch(cam, next);
    }
  }, [torchOn]);

  const toggleBurst = useCallback(() => {
    setBurstMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('foto-hidro:burst', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const changeZoom = useCallback(
    async (delta: number) => {
      const cam = camRef.current;
      if (!cam) return;
      const next = await setZoom(cam, clampDisplay(zoom + delta, cam.caps));
      setZoomState(next);
    },
    [zoom],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinches.current = { start: startDist, startZoom: zoom };
    }
  }, [zoom]);

  const handleTouchMove = useCallback(
    async (e: React.TouchEvent) => {
      const cam = camRef.current;
      if (!cam || !pinches.current || e.touches.length !== 2) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = d / pinches.current.start;
      const next = await setZoom(cam, pinches.current.startZoom * ratio);
      setZoomState(next);
    },
    [],
  );

  const handleTouchEnd = useCallback(() => {
    pinches.current = null;
  }, []);

  const handleSave = useCallback(async () => {
    if (!blob) return;
    await upsertRecord({
      campaignId,
      towerId,
      floor: apt.floor,
      unit: apt.unit,
      side: apt.side,
      aptCode: apt.aptCode,
      photo: blob,
      capturedAt: Date.now(),
    });
    onSaved(ocr?.value ?? undefined);
  }, [blob, campaignId, towerId, apt, onSaved, ocr]);

  const handleFile = useCallback(
    async (file: File) => {
      if (burstMode) {
        await upsertRecord({
          campaignId,
          towerId,
          floor: apt.floor,
          unit: apt.unit,
          side: apt.side,
          aptCode: apt.aptCode,
          photo: file,
          capturedAt: Date.now(),
        });
        onSaved();
      } else {
        photoTakenRef.current = true;
        setBlob(file);
        const url = URL.createObjectURL(file);
        setPreview(url);
        setFlash(true);
        setTimeout(() => setFlash(false), 220);
        setPhase('preview');
        void downloadWatermarked(file);
        setOcrBusy(true);
        recognizeMeter(file)
          .then((r) => {
            if (r.value !== null) {
              setOcr(r);
              toast?.(`OCR detectou: ${formatOcrValue(r.value)}`);
            } else {
              toast?.('Não li o índice. Preencha manualmente.');
            }
          })
          .catch((e) => {
            console.warn('OCR erro:', e);
            toast?.('OCR indisponível. Preencha manualmente.');
          })
          .finally(() => setOcrBusy(false));
      }
    },
    [burstMode, campaignId, towerId, apt, onSaved, downloadWatermarked, toast],
  );

  return createPortal(
    <div className={`camera-overlay${flash ? ' cam-flash' : ''}`}>
      <div className="cam-top">
        <button className="icon-btn glass" onClick={onClose} aria-label="Fechar câmera">
          <X size={22} />
        </button>
        <div className="cam-title">
          <span className="cam-apt mono">{apt.aptCode}</span>
          <span className="cam-tower">Torre {towerId} · Andar {pad2(apt.floor)}</span>
        </div>
        {onPrev ? (
          <button className="icon-btn glass" onClick={onPrev} aria-label="Voltar para o apt anterior">
            <Undo2 size={20} />
          </button>
        ) : (
          <span className="cam-spacer" />
        )}
      </div>

      <video
        ref={videoRef}
        className="cam-video"
        playsInline
        muted
        autoPlay
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        aria-label="Câmera"
      />

      {phase === 'live' && (
        <>
          <div className="reticle" aria-hidden="true">
            <span className="rc rc-tl" />
            <span className="rc rc-tr" />
            <span className="rc rc-bl" />
            <span className="rc rc-br" />
            <span className="reticle-hint">Centralize o hidrômetro</span>
          </div>

          <div className="cam-controls">
            {torchSupported && (
              <button
                className={`cam-tool glass${torchOn ? ' is-on' : ''}`}
                onClick={toggleTorch}
                aria-label={torchOn ? 'Desligar lanterna' : 'Ligar lanterna contínua'}
                aria-pressed={torchOn}
              >
                {torchOn ? <Zap size={20} /> : <ZapOff size={20} />}
              </button>
            )}

            <button
              className={`cam-tool glass${burstMode ? ' is-burst-on' : ''}`}
              onClick={toggleBurst}
              aria-label={burstMode ? 'Desativar modo rápido (Burst)' : 'Ativar modo rápido (Burst)'}
              aria-pressed={burstMode}
            >
              <Layers size={20} />
              <span className="cam-tool-sub">BURST</span>
            </button>

            {zoomSupported && (
              <div className="cam-zoom glass">
                <button className="cam-zoom-btn" onClick={() => changeZoom(-zoomCaps.step)} aria-label="Diminuir zoom">
                  <Minus size={18} />
                </button>
                <span className="cam-zoom-val mono">{zoom.toFixed(1)}×</span>
                <button className="cam-zoom-btn" onClick={() => changeZoom(zoomCaps.step)} aria-label="Aumentar zoom">
                  <Plus size={18} />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {phase === 'preview' && preview && (
        <div className="cam-preview-wrap">
          <img src={preview} alt={`Foto ${apt.aptCode}`} className="cam-preview" />
          {(ocr || ocrBusy) && (
            <div className="ocr-badge">
              {ocrBusy ? (
                <span className="ocr-badge-text"><ScanText size={14} /> Lendo…</span>
              ) : ocr ? (
                <span className="ocr-badge-text">
                  <ScanText size={14} /> OCR: <strong>{formatOcrValue(ocr.value)}</strong>
                  {ocr.confidence < 60 && <span className="ocr-low">?</span>}
                </span>
              ) : null}
            </div>
          )}
        </div>
      )}

      {phase === 'error' && (
        <div className="cam-error glass">
          <p>{errorMsg}</p>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} aria-label="Abrir câmera nativa">
            <Upload size={18} /> Abrir câmera nativa
          </button>
        </div>
      )}

      {phase === 'live' && (
        <button
          className={`capture-btn${burstMode ? ' capture-btn--burst' : ''}`}
          onClick={handleCapture}
          disabled={saving}
          aria-label={burstMode ? 'Tirar foto e avançar instantaneamente' : 'Tirar foto'}
        >
          <Camera size={30} />
        </button>
      )}

      {phase === 'preview' && (
        <div className="cam-actions">
          <button className="btn-ghost" onClick={handleRetake}>
            <RotateCcw size={18} /> Refazer
          </button>
          <button className="btn-primary" onClick={handleSave}>
            <Camera size={18} /> {ocr?.value != null ? `Salvar ${formatOcrValue(ocr.value)}` : 'Salvar e próximo'}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>,
    document.body,
  );
}

function clampDisplay(value: number, caps: CameraCapabilities): number {
  const snapped = Math.round(value / caps.zoomStep) * caps.zoomStep;
  return Math.min(caps.zoomMax, Math.max(caps.zoomMin, snapped));
}

function formatOcrValue(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(v);
}
