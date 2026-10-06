import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Camera, Eye, Keyboard, Navigation, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ open, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(overlayRef.current!, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(
        panelRef.current!,
        { opacity: 0, y: 18, scale: 0.96 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
      );
    });
    return () => ctx.revert();
  }, [open]);

  if (!open) return null;

  return (
    <div ref={overlayRef} className="modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel glass shortcuts-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-modal-header">
          <div className="shortcuts-modal-title">
            <Keyboard size={22} className="text-cyan" />
            <h3>Atalhos de Teclado</h3>
          </div>
          <button
            className="icon-btn glass shortcuts-close-btn"
            onClick={onClose}
            aria-label="Fechar atalhos (Esc)"
            title="Fechar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        <p className="shortcuts-modal-desc">
          Agilize a conferência de fotos e o preenchimento de medições no computador:
        </p>

        <div className="shortcuts-content">
          {/* SEÇÃO: ÍNDICES & FOTOS */}
          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">
              <Eye size={16} /> Índices & Fotos
            </h4>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-desc">Salvar índice e avançar</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Enter</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Próxima foto / apartamento</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">→</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">PgDn</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Alt</kbd>+<kbd className="key-cap">→</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Foto / apartamento anterior</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">←</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">PgUp</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Alt</kbd>+<kbd className="key-cap">←</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Ampliar foto (Lightbox)</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Z</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Espaço</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Desfazer último índice</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Ctrl</kbd>+<kbd className="key-cap">Z</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Ler hidrômetro com OCR</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Alt</kbd>+<kbd className="key-cap">O</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">O</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Girar foto 90° horário</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">R</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Alt</kbd>+<kbd className="key-cap">R</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Girar foto 90° anti-horário</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Shift</kbd>+<kbd className="key-cap">R</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Buscar apartamento</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">/</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Ctrl</kbd>+<kbd className="key-cap">F</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Alternar entre Torres (A–H)</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">[</kbd>
                  <kbd className="key-cap">]</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO: CÂMERA & CAPTURA */}
          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">
              <Camera size={16} /> Câmera & Captura
            </h4>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-desc">Disparar foto / Confirmar</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Espaço</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">Enter</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Fechar câmera / Retirar foto</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Esc</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Ligar / desligar lanterna</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">T</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Alternar Modo Burst</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">B</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Zoom da câmera</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">+</kbd>
                  <kbd className="key-cap">-</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Subir / descer de andar</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">↑</kbd>
                  <kbd className="key-cap">↓</kbd>
                </div>
              </div>
            </div>
          </div>

          {/* SEÇÃO: GERAL */}
          <div className="shortcuts-section">
            <h4 className="shortcuts-section-title">
              <Navigation size={16} /> Geral
            </h4>
            <div className="shortcuts-grid">
              <div className="shortcut-row">
                <span className="shortcut-desc">Abrir este guia de atalhos</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">?</kbd>
                  <span className="key-or">ou</span>
                  <kbd className="key-cap">F1</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span className="shortcut-desc">Fechar janelas / modais</span>
                <div className="shortcut-keys">
                  <kbd className="key-cap">Esc</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shortcuts-modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
