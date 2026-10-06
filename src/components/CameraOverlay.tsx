import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Focus, Layers, Lock, Minus, Plus, RotateCcw, ScanText, Undo2, Upload, Volume2, VolumeX, X, Zap, ZapOff } from 'lucide-react';
import {
  ActiveCamera,
  CameraCapabilities,
  captureFrame,
  checkVideoSharpness,
  setFocusPoint,
  setTorch,
  setZoom,
  SHARPNESS_THRESHOLD,
  startCamera,
  stopCamera,
  triggerAutoFocus,
} from '../lib/camera';
import { recognizeMeter, OcrResult } from '../lib/ocr';
import { watermarkPhoto, formatWatermarkDate } from '../lib/watermark';
import { isSoundEnabled, playFocusFeedback, playShutterFeedback, setSoundEnabled } from '../lib/audioHaptics';
import { upsertRecord } from '../db/records';
import { bgOcr } from '../lib/bgOcr';
import { pad2 } from '../lib/utils';
import { UnitRef } from '../lib/towers';

interface Props {
  campaignId: number;
  towerId: string;
  apt: UnitRef;
  initialPhoto?: Blob | null;
  readOnly?: boolean;
  onPrev?: () => void;
  onSaved: (ocrIndex?: number) => void;
  onClose: () => void;
  toast?: (msg: string) => void;
}

type Phase = 'opening' | 'live' | 'preview' | 'error';

export default function CameraOverlay({ campaignId, towerId, apt, initialPhoto, readOnly, onPrev, onSaved, onClose, toast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<ActiveCamera | null>(null);
  const startedRef = useRef(false);
  const photoTakenRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(() => (readOnly && initialPhoto ? 'preview' : 'opening'));
  const [preview, setPreview] = useState<string | null>(() => (readOnly && initialPhoto ? URL.createObjectURL(initialPhoto) : null));
  const [blob, setBlob] = useState<Blob | null>(() => (readOnly && initialPhoto ? initialPhoto : null));
  const [flash, setFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [torchOn, setTorchOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('foto-hidro:torch') === 'true';
    } catch {
      return false;
    }
  });

  const [reticleOn, setReticleOn] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem('foto-hidro:reticle');
      return v === null ? true : v === 'true';
    } catch {
      return true;
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

  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const [saving, setSaving] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [zoomCaps, setZoomCaps] = useState({ min: 1, max: 1, step: 0.1 });
  const [zoomSupported, setZoomSupported] = useState(false);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

  const [focusTarget, setFocusTarget] = useState<{ x: number; y: number } | null>(null);
  const [isRefocusing, setIsRefocusing] = useState(false);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const hasPinchedRef = useRef(false);
  const lastTapTimeRef = useRef(0);

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
    if (readOnly) return;
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    return () => {
      stop();
      startedRef.current = false;
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [readOnly, start, stop]);

  useEffect(() => {
    if (readOnly) {
      if (initialPhoto) {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(initialPhoto));
        setBlob(initialPhoto);
        setPhase('preview');
      }
      return;
    }
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setBlob(null);
    setOcr(null);
    setOcrBusy(false);
    photoTakenRef.current = false;
    if (camRef.current && phase !== 'error') {
      setPhase('live');
      if (torchOn && camRef.current.caps.torchSupported) {
        void setTorch(camRef.current, true);
      }
    } else if (phase !== 'error') {
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apt.aptCode, readOnly, initialPhoto]);

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

  const handleFocusAt = useCallback(
    (clientX: number, clientY: number) => {
      if (phase !== 'live') return;
      lastTapTimeRef.current = Date.now();

      const video = videoRef.current;
      if (!video) return;

      const rect = video.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
      const normY = Math.max(0, Math.min(1, (clientY - rect.top) / (rect.height || 1)));

      setFocusTarget({ x: clientX, y: clientY });
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => {
        setFocusTarget(null);
      }, 1400);

      playFocusFeedback();

      if (camRef.current) {
        void setFocusPoint(camRef.current, { x: normX, y: normY });
      }
    },
    [phase],
  );

  const handleCapture = useCallback(async () => {
    if (readOnly || !videoRef.current || saving) return;
    try {
      if (camRef.current && videoRef.current) {
        const sharpness = checkVideoSharpness(videoRef.current);
        if (sharpness < SHARPNESS_THRESHOLD) {
          setIsRefocusing(true);
          const rect = videoRef.current.getBoundingClientRect();
          setFocusTarget({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
          playFocusFeedback();

          await triggerAutoFocus(camRef.current);
          await new Promise((r) => setTimeout(r, 260));
          setIsRefocusing(false);
          if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
          focusTimerRef.current = setTimeout(() => setFocusTarget(null), 800);
        }
      }

      setFlash(true);
      playShutterFeedback();
      setTimeout(() => setFlash(false), 220);

      const b = await captureFrame(videoRef.current);

      if (burstMode) {
        setSaving(true);
        try {
          const recordId = await upsertRecord({
            campaignId,
            towerId,
            floor: apt.floor,
            unit: apt.unit,
            side: apt.side,
            aptCode: apt.aptCode,
            photo: b,
            capturedAt: Date.now(),
          });
          void downloadWatermarked(b);
          if (recordId) {
            void bgOcr.enqueue(recordId, b);
          }
          onSaved();
        } finally {
          setSaving(false);
        }
      } else {
        photoTakenRef.current = true;
        setBlob(b);
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
  }, [burstMode, campaignId, towerId, apt, onSaved, saving, downloadWatermarked, toast]);

  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    photoTakenRef.current = false;
    setPreview(null);
    setBlob(null);
    setOcr(null);
    setOcrBusy(false);
    if (camRef.current && phase !== 'error') {
      setPhase('live');
      if (torchOn && camRef.current.caps.torchSupported) {
        void setTorch(camRef.current, true);
      }
    } else {
      void start();
    }
  }, [preview, start, torchOn, phase]);

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

  const toggleReticle = useCallback(() => {
    setReticleOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('foto-hidro:reticle', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      setSoundEnabled(next);
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
    if (e.touches.length === 1) {
      touchStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    } else if (e.touches.length === 2) {
      touchStartPos.current = null;
      hasPinchedRef.current = true;
      const startDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      pinches.current = { start: startDist, startZoom: zoom };
    }
  }, [zoom]);

  const handleTouchMove = useCallback(
    async (e: React.TouchEvent) => {
      if (touchStartPos.current && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartPos.current.x;
        const dy = e.touches[0].clientY - touchStartPos.current.y;
        if (Math.hypot(dx, dy) > 14) {
          touchStartPos.current = null;
        }
      }
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

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartPos.current && !hasPinchedRef.current) {
        const elapsed = Date.now() - touchStartPos.current.time;
        if (elapsed < 500) {
          handleFocusAt(touchStartPos.current.x, touchStartPos.current.y);
        }
      }
      touchStartPos.current = null;
      pinches.current = null;
      if (e.touches.length === 0) {
        setTimeout(() => {
          hasPinchedRef.current = false;
        }, 350);
      }
    },
    [handleFocusAt],
  );

  const handleVideoClick = useCallback(
    (e: React.MouseEvent) => {
      if (Date.now() - lastTapTimeRef.current < 450) return;
      handleFocusAt(e.clientX, e.clientY);
    },
    [handleFocusAt],
  );

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
      index: ocr?.value ?? undefined,
      capturedAt: Date.now(),
    });
    onSaved(ocr?.value ?? undefined);
  }, [blob, campaignId, towerId, apt, onSaved, ocr]);

  const handleFile = useCallback(
    async (file: File) => {
      if (readOnly) return;
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
        void downloadWatermarked(file);
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (phase === 'preview') {
          handleRetake();
        } else {
          onClose();
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (phase === 'live') {
          void handleCapture();
        } else if (phase === 'preview') {
          void handleSave();
        }
        return;
      }

      if (phase === 'live') {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          void toggleTorch();
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          toggleBurst();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          void changeZoom(0.2);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          void changeZoom(-0.2);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleCapture, handleSave, handleRetake, onClose, toggleTorch, toggleBurst, changeZoom]);

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
          <div className="cam-top-spacer" />
        )}
      </div>

      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="cam-video"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleVideoClick}
        aria-label="Câmera"
      />

      {phase === 'live' && focusTarget && (
        <div
          className="cam-focus-ring"
          style={{ left: focusTarget.x, top: focusTarget.y }}
          aria-hidden="true"
        >
          <span className="cam-focus-corner cam-focus-tl" />
          <span className="cam-focus-corner cam-focus-tr" />
          <span className="cam-focus-corner cam-focus-bl" />
          <span className="cam-focus-corner cam-focus-br" />
          <span className="cam-focus-dot" />
        </div>
      )}

      {isRefocusing && (
        <div className="cam-autofocus-badge" aria-live="polite">
          <Focus size={15} className="spin" />
          <span>Focando hidrômetro…</span>
        </div>
      )}

      {phase === 'live' && (
        <>
          {reticleOn && (
            <div className="reticle" aria-hidden="true">
              <span className="rc rc-tl" />
              <span className="rc rc-tr" />
              <span className="rc rc-bl" />
              <span className="rc rc-br" />
              <div className="reticle-center-line" />
              <div className="reticle-badge">ALINHE OS NÚMEROS AQUI</div>
              <div className="reticle-hint">
                <span className="reticle-black">■ Pretos (m³)</span>
                <span className="reticle-sep">·</span>
                <span className="reticle-red">■ Vermelhos (L)</span>
              </div>
            </div>
          )}

          <div className="cam-controls">
            {torchSupported && (
              <button
                className={`cam-tool glass${torchOn ? ' is-on' : ''}`}
                onClick={toggleTorch}
                aria-label={torchOn ? 'Desligar lanterna' : 'Ligar lanterna contínua'}
                aria-pressed={torchOn}
              >
                {torchOn ? <Zap size={20} /> : <ZapOff size={20} />}
                <span className="cam-tool-sub">LUZ</span>
              </button>
            )}

            <button
              className={`cam-tool glass${reticleOn ? ' is-on' : ''}`}
              onClick={toggleReticle}
              aria-label={reticleOn ? 'Ocultar mira guia' : 'Exibir mira guia'}
              aria-pressed={reticleOn}
            >
              <Focus size={20} />
              <span className="cam-tool-sub">MIRA</span>
            </button>

            <button
              className={`cam-tool glass${burstMode ? ' is-burst-on' : ''}`}
              onClick={toggleBurst}
              aria-label={burstMode ? 'Desativar modo rápido (Burst)' : 'Ativar modo rápido (Burst)'}
              aria-pressed={burstMode}
            >
              <Layers size={20} />
              <span className="cam-tool-sub">BURST</span>
            </button>

            <button
              className={`cam-tool glass${soundOn ? ' is-on' : ''}`}
              onClick={toggleSound}
              aria-label={soundOn ? 'Desativar som do disparo' : 'Ativar som do disparo'}
              aria-pressed={soundOn}
            >
              {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span className="cam-tool-sub">SOM</span>
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
          {readOnly ? (
            <>
              <div className="cam-readonly-badge">
                <Lock size={15} /> Medição Concluída (Bloqueada)
              </div>
              <button className="btn-primary" onClick={onClose}>
                Fechar
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={handleRetake}>
                <RotateCcw size={18} /> Refazer
              </button>
              <button className="btn-primary" onClick={handleSave}>
                <Camera size={18} /> {ocr?.value != null ? `Salvar ${formatOcrValue(ocr.value)}` : 'Salvar e próximo'}
              </button>
            </>
          )}
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
