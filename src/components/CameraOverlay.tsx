import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RotateCcw, Undo2, Upload, X } from 'lucide-react';
import { captureFrame, startCamera, stopCamera } from '../lib/camera';
import { upsertRecord } from '../db/records';
import { pad2 } from '../lib/utils';
import { UnitRef } from '../lib/towers';

interface Props {
  campaignId: number;
  towerId: string;
  apt: UnitRef;
  onPrev?: () => void;
  onSaved: () => void;
  onClose: () => void;
}

type Phase = 'opening' | 'live' | 'preview' | 'error';

export default function CameraOverlay({ campaignId, towerId, apt, onPrev, onSaved, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('opening');
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [flash, setFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const stop = useCallback(() => {
    stopCamera(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const beginCamera = useCallback(async () => {
    startedRef.current = true;
    setPhase('opening');
    setErrorMsg('');
    try {
      if (!videoRef.current) return;
      const stream = await startCamera(videoRef.current);
      streamRef.current = stream;
      setPhase('live');
    } catch (e) {
      console.warn('Câmera indisponível, usando arquivo', e);
      setErrorMsg(
        'Não foi possível abrir a câmera integrada. Use a câmera nativa tocando abaixo.',
      );
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    void beginCamera();
    return () => {
      stop();
      startedRef.current = false;
    };
  }, [beginCamera, stop]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const b = await captureFrame(videoRef.current);
      setBlob(b);
      stop();
      const url = URL.createObjectURL(b);
      setPreview(url);
      setFlash(true);
      setTimeout(() => setFlash(false), 350);
      setPhase('preview');
    } catch (e) {
      setErrorMsg('Falha ao capturar a imagem.');
      setPhase('error');
    }
  }, [stop]);

  const handleRetake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setBlob(null);
    void beginCamera();
  }, [beginCamera, preview]);

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
    onSaved();
  }, [blob, campaignId, towerId, apt, onSaved]);

  const handleFile = useCallback(
    async (file: File) => {
      const b = file;
      setBlob(b);
      const url = URL.createObjectURL(b);
      setPreview(url);
      setFlash(true);
      setTimeout(() => setFlash(false), 350);
      setPhase('preview');
    },
    [],
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

      {phase === 'live' || phase === 'opening' ? (
        <>
          <video
            ref={videoRef}
            className="cam-video"
            playsInline
            muted
            autoPlay
            aria-label="Câmera"
          />
          <div className="reticle" aria-hidden="true">
            <span className="rc rc-tl" />
            <span className="rc rc-tr" />
            <span className="rc rc-bl" />
            <span className="rc rc-br" />
            <span className="reticle-hint">Centralize o hidrômetro</span>
          </div>
        </>
      ) : null}

      {phase === 'preview' && preview && (
        <div className="cam-preview-wrap">
          <img src={preview} alt={`Foto ${apt.aptCode}`} className="cam-preview" />
        </div>
      )}

      {phase === 'error' && (
        <div className="cam-error glass">
          <p>{errorMsg}</p>
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            aria-label="Abrir câmera nativa"
          >
            <Upload size={18} /> Abrir câmera nativa
          </button>
        </div>
      )}

      {phase === 'live' && (
        <button className="capture-btn" onClick={handleCapture} aria-label="Tirar foto">
          <Camera size={30} />
        </button>
      )}

      {phase === 'preview' && (
        <div className="cam-actions">
          <button className="btn-ghost" onClick={handleRetake}>
            <RotateCcw size={18} /> Refazer
          </button>
          <button className="btn-primary" onClick={handleSave}>
            <Camera size={18} /> Salvar e próximo
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
        }}
      />
    </div>,
    document.body,
  );
}
