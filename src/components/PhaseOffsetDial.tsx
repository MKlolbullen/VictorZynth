import React, { useRef, useState, useCallback } from 'react';

interface PhaseOffsetDialProps {
  phase: number; // 0.0 to 1.0
  modOffset?: number;
  color?: 'cyan' | 'amber';
  label?: string;
  compact?: boolean;
  onChange: (phase: number) => void;
}

export const PhaseOffsetDial: React.FC<PhaseOffsetDialProps> = ({
  phase,
  modOffset = 0,
  color = 'cyan',
  label = 'Phase',
  compact = false,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dialRef = useRef<SVGSVGElement | null>(null);

  // Normalize phase between 0 and 1
  const normPhase = ((phase % 1) + 1) % 1;
  const effectivePhase = (((normPhase + modOffset) % 1) + 1) % 1;

  // Colors
  const activeColor = color === 'cyan' ? '#22d3ee' : '#fbbf24';
  const glowColor = color === 'cyan' ? 'rgba(34, 211, 238, 0.8)' : 'rgba(251, 191, 36, 0.8)';
  const activeBg = color === 'cyan' ? 'bg-cyan-950/80 text-cyan-200 border-cyan-700/60' : 'bg-amber-950/80 text-amber-200 border-amber-700/60';
  const hoverBtn = color === 'cyan' ? 'hover:bg-cyan-900/60 hover:text-cyan-200' : 'hover:bg-amber-900/60 hover:text-amber-200';

  // Angle in degrees: 0° is top (-90° in standard Cartesian SVG)
  const angleDeg = normPhase * 360;
  const angleRad = (normPhase * 360 - 90) * (Math.PI / 180);

  // Center and radius
  const cx = 18;
  const cy = 18;
  const r = 13;

  // Pointer position
  const px = cx + r * Math.cos(angleRad);
  const py = cy + r * Math.sin(angleRad);

  // Arc path for the phase sweep
  const sweepAngle = normPhase * 360;
  const largeArcFlag = sweepAngle > 180 ? 1 : 0;
  const arcStartX = cx;
  const arcStartY = cy - r;
  const arcPath =
    normPhase >= 0.999
      ? `M ${arcStartX} ${arcStartY} A ${r} ${r} 0 1 1 ${arcStartX - 0.01} ${arcStartY}`
      : `M ${arcStartX} ${arcStartY} A ${r} ${r} 0 ${largeArcFlag} 1 ${px} ${py}`;

  // Handle angle calculation from pointer
  const handlePointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;

      // Calculate angle in degrees from top (0 to 360)
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (deg < 0) deg += 360;
      const newPhase = Math.round((deg / 360) * 200) / 200; // 0.005 steps
      onChange(Math.max(0, Math.min(1, newPhase)));
    },
    [onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handlePointer(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handlePointer(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className={`flex items-center space-x-2 bg-zinc-950/90 p-1.5 rounded border border-zinc-800 select-none knob-spring-container ${
        isDragging ? 'is-dragging ring-1 ring-cyan-500/50' : 'hover:border-zinc-700'
      }`}
      title="Initial cycle starting phase offset"
    >
      {/* Interactive Dial with Spring Physics */}
      <div className="relative flex-shrink-0 cursor-pointer" onMouseDown={handleMouseDown}>
        <svg
          ref={dialRef}
          width="36"
          height="36"
          viewBox="0 0 36 36"
          className={`knob-cap-spring ${isDragging ? 'scale-95' : 'hover:scale-105'}`}
        >
          {/* Outer ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="#09090b"
            stroke="#27272a"
            strokeWidth="2"
          />

          {/* Quadrant tick marks: 0, 90, 180, 270 */}
          <line x1={cx} y1={cy - r} x2={cx} y2={cy - r + 3} stroke="#52525b" strokeWidth="1" />
          <line x1={cx + r} y1={cy} x2={cx + r - 3} y2={cy} stroke="#52525b" strokeWidth="1" />
          <line x1={cx} y1={cy + r} x2={cx} y2={cy + r - 3} stroke="#52525b" strokeWidth="1" />
          <line x1={cx - r} y1={cy} x2={cx - r + 3} y2={cy} stroke="#52525b" strokeWidth="1" />

          {/* Phase Sweep Arc */}
          {normPhase > 0.01 && (
            <path
              d={arcPath}
              fill="none"
              stroke={activeColor}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.85"
              className="knob-arc-spring"
            />
          )}

          {/* Needle / Pointer Vector with spring rotation */}
          <line
            x1={cx}
            y1={cy}
            x2={px}
            y2={py}
            stroke={activeColor}
            strokeWidth="1.8"
            strokeLinecap="round"
            className="knob-needle-spring"
            style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
          />

          {/* Center Pivot */}
          <circle cx={cx} cy={cy} r="2.5" fill="#ffffff" />

          {/* Starting point node at perimeter with spring pop */}
          <circle
            cx={px}
            cy={py}
            r={isDragging ? 3.2 : 2.5}
            fill="#ffffff"
            stroke={activeColor}
            strokeWidth="1.2"
            className="transition-all duration-150"
            style={{ filter: `drop-shadow(0 0 ${isDragging ? 6 : 4}px ${glowColor})` }}
          />
        </svg>
      </div>

      {/* Label & Value Readout */}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <div className="flex items-center justify-between space-x-1 knob-value-spring">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">
            {label}:
          </span>
          <span
            className={`text-[11px] font-mono font-bold px-1 rounded transition-all duration-150 ${
              normPhase > 0 ? activeBg : 'text-zinc-400'
            } ${isDragging ? 'scale-105 shadow-sm' : ''}`}
          >
            {Math.round(angleDeg)}°
          </span>
        </div>

        {/* Quick Snaps: 0°, 90°, 180°, 270° with tactile spring feedback */}
        {!compact && (
          <div className="flex items-center space-x-0.5 mt-0.5">
            {[0, 0.25, 0.5, 0.75].map((val) => {
              const deg = Math.round(val * 360);
              const isSelected = Math.abs(normPhase - val) < 0.02;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => onChange(val)}
                  className={`px-1 py-0.2 text-[8px] font-mono rounded tactile-spring-btn ${
                    isSelected
                      ? activeBg
                      : 'text-zinc-500 bg-zinc-900/60 ' + hoverBtn
                  }`}
                  title={`Snap phase to ${deg}°`}
                >
                  {deg}°
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
