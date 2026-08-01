import { Check, Gauge } from 'lucide-react';
import { UnitRef } from '../lib/towers';
import { usePhotoUrl } from '../hooks/usePhotoUrl';

interface Props {
  apt: UnitRef;
  hasPhoto: boolean;
  hasIndex: boolean;
  photo?: Blob | null;
  onTap: () => void;
  active?: boolean;
}

export default function AptButton({ apt, hasPhoto, hasIndex, photo, onTap, active }: Props) {
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
    </button>
  );
}
