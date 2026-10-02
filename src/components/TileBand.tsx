import { useId } from 'react';
import './TileBand.css';

interface TileBandProps {
  height?: number;
  // Any CSS color. The quote document passes the business's own color.
  color?: string;
}

// One azulejo tile is drawn on a 40 by 40 grid and repeated. The motif has
// four-fold symmetry: a star in the middle and a quarter rosette in each corner,
// so four neighbouring tiles complete a full rosette where they meet.
export function TileBand({ height = 48, color = 'var(--azulejo)' }: TileBandProps) {
  const patternId = useId();
  return (
    <svg className="faixa-azulejo" width="100%" height={height} style={{ color }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={patternId} width={height} height={height} patternUnits="userSpaceOnUse" viewBox="0 0 40 40">
          <rect width="40" height="40" fill="#FFFFFF" />
          {[[0, 0], [40, 0], [0, 40], [40, 40]].map(([cx, cy]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r="13" fill="currentColor" />
              <circle cx={cx} cy={cy} r="9" fill="#FFFFFF" />
              <circle cx={cx} cy={cy} r="5.5" fill="currentColor" />
              <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
            </g>
          ))}
          <path
            fill="currentColor"
            d="M20 5C21.5 14 26 18.5 35 20C26 21.5 21.5 26 20 35C18.5 26 14 21.5 5 20C14 18.5 18.5 14 20 5Z"
          />
          <circle cx="20" cy="20" r="3.4" fill="#FFFFFF" />
          <circle cx="20" cy="20" r="1.5" fill="currentColor" />
          {[[20, 0], [20, 40], [0, 20], [40, 20]].map(([x, y]) => (
            <path key={`${x}-${y}`} fill="currentColor" d={`M${x} ${y - 3}L${x + 3} ${y}L${x} ${y + 3}L${x - 3} ${y}Z`} />
          ))}
          <rect width="40" height="40" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
