import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface Props {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}

export default function ProgressRing({ value, size = 64, stroke = 6, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fgRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = fgRef.current;
    if (!el) return;
    gsap.to(el, {
      strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))),
      duration: 0.9,
      ease: 'power2.out',
    });
  }, [value, c]);

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="ring-bg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          ref={fgRef}
          className="ring-fg"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">{label ?? `${Math.round(value * 100)}%`}</div>
    </div>
  );
}
