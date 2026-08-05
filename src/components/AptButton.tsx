import { Check, Clock, Gauge, X } from 'lucide-react';
import { UnitRef } from '../lib/towers';
import { usePhotoUrl } from '../hooks/usePhotoUrl';

interface Props {
  apt: UnitRef;
  hasPhoto: boolean;
  hasIndex: boolean;
  photo?: Blob | null;
  onTap: () => void;
  onDelete?: () => void;
  onHistory?: () => void;
  active?: boolean;
}

export default function AptButton({ apt, hasPhoto, hasIndex, photo, onTap, onDelete, onHistory, active }: Props) {
  const thumb = usePhotoUrl(photo);
  const state = hasIndex ? 'indexed' : hasPhoto ? 'photo' : 'empty';

  return (
    <button
      className={`apt-btn apt-${state}${active ? ' apt-active' : ''}`}
      onClick={onTap}
      aria-label={`Apartamento ${apt.aptCode}`}
    >
      {thumb && <span className="apt-thumb" style={{ backgroundImage: `url(${thumb})` }} />}
      <span className="apt-code">{apt.aptCode}</span>
      <span className="apt-status">
        {state === 'indexed' && <Gauge size={12} aria-hidden />}
        {state === 'photo' && <Check size={12} aria-hidden />}
        {state === 'empty' && <span className="apt-dot" aria-hidden />}
      </span>
      {onHistory && (
        <span
          className="apt-history"
          onClick={(e) => { e.stopPropagation(); onHistory(); }}
          role="button"
          aria-label={`Histórico ${apt.aptCode}`}
        >
          <Clock size={10} />
        </span>
      )}
      {onDelete && hasPhoto && (
        <span
          className="apt-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          role="button"
          aria-label={`Remover foto ${apt.aptCode}`}
        >
          <X size={12} />
        </span>
      )}
    </button>
  );
}
