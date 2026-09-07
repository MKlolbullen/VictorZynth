import React, { useState, useRef, useEffect, useCallback } from 'react';

interface KnobProps {
  id?: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  modValue?: number; // Instantaneous live modulated value for the outer ring (-1 to 1 or absolute)
  modOffset?: number; // Offset applied by modulation
  color?: 'cyan' | 'amber' | 'emerald' | 'violet' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}

export const Knob: React.FC<KnobProps> = ({
  id,
  label,
  value,
  min,
  max,
  step = 0.01,
  defaultValue,
  unit = '',
  modOffset = 0,
  color = 'cyan',
  size = 'md',
  formatValue,
  onChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValRef = useRef(value);

  const defVal = defaultValue !== undefined ? defaultValue : (min + max) / 2;

  // Normalized value (0 to 1)
  const normVal = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Modulated normalized value (0 to 1)
  const modClampedVal = Math.max(min, Math.min(max, value + modOffset * (max - min)));
  const normModVal = Math.max(0, Math.min(1, (modClampedVal - min) / (max - min)));

  // Angles: Start at -135 deg to +135 deg (270 degree arc)
  const startAngle = -135;
  const endAngle = 135;
  const currentAngle = startAngle + normVal * (endAngle - startAngle);
  const modAngle = startAngle + normModVal * (endAngle - startAngle);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startYRef.current = e.touches[0].clientY;
    startValRef.current = value;
  };

  const handleDoubleClick = () => {
    onChange(defVal);
  };

  const handleMove = useCallback(
    (clientY: number, shiftKey: boolean) => {
      const deltaY = startYRef.current - clientY;
      const sensitivity = shiftKey ? 0.001 : 0.005; // Shift for fine adjustment
      const range = max - min;
      let newVal = startValRef.current + deltaY * range * sensitivity;
      newVal = Math.max(min, Math.min(max, newVal));

      if (step) {
        newVal = Math.round(newVal / step) * step;
      }
      onChange(newVal);
    },
    [max, min, step, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY, e.shiftKey);
    };

    const onTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientY, false);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [isDragging, handleMove]);

  // Dimensions
  const dims = {
    sm: { diameter: 42, stroke: 3, radius: 17, text: 'text-[10px]' },
    md: { diameter: 54, stroke: 4, radius: 22, text: 'text-xs' },
    lg: { diameter: 68, stroke: 5, radius: 28, text: 'text-sm' },
  }[size];

  const circumference = 2 * Math.PI * dims.radius;
  const arcLength = (270 / 360) * circumference;
  const strokeDashoffset = arcLength - normVal * arcLength;
  const modDashoffset = arcLength - normModVal * arcLength;

  const colorMap = {
    cyan: {
      stroke: 'stroke-cyan-400',
      glow: 'rgba(34, 211, 238, 0.4)',
      accent: 'text-cyan-400',
      dot: 'bg-cyan-400',
      modRing: 'stroke-cyan-300/60',
    },
    amber: {
      stroke: 'stroke-amber-400',
      glow: 'rgba(251, 191, 36, 0.4)',
      accent: 'text-amber-400',
      dot: 'bg-amber-400',
      modRing: 'stroke-amber-300/60',
    },
    emerald: {
      stroke: 'stroke-emerald-400',
      glow: 'rgba(52, 211, 153, 0.4)',
      accent: 'text-emerald-400',
      dot: 'bg-emerald-400',
      modRing: 'stroke-emerald-300/60',
    },
    violet: {
      stroke: 'stroke-violet-400',
      glow: 'rgba(167, 139, 250, 0.4)',
      accent: 'text-violet-400',
      dot: 'bg-violet-400',
      modRing: 'stroke-violet-300/60',
    },
    rose: {
      stroke: 'stroke-rose-400',
      glow: 'rgba(251, 113, 133, 0.4)',
      accent: 'text-rose-400',
      dot: 'bg-rose-400',
      modRing: 'stroke-rose-300/60',
    },
  }[color];

  const formattedDisplay = formatValue
    ? formatValue(value)
    : step >= 1
    ? `${Math.round(value)}${unit}`
    : `${value.toFixed(2)}${unit}`;

  return (
    <div
      id={id}
      className="flex flex-col items-center select-none group cursor-ns-resize"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      title={`${label}: ${formattedDisplay} (Double click to reset, Shift+drag for fine tuning)`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          width={dims.diameter}
          height={dims.diameter}
          viewBox={`0 0 ${dims.diameter} ${dims.diameter}`}
          className="transform -rotate-90 origin-center"
        >
          {/* Background Track Arc */}
          <circle
            cx={dims.diameter / 2}
            cy={dims.diameter / 2}
            r={dims.radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={dims.stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            className="transform rotate-[135deg] origin-center"
          />

          {/* Active Value Arc */}
          <circle
            cx={dims.diameter / 2}
            cy={dims.diameter / 2}
            r={dims.radius}
            fill="none"
            strokeWidth={dims.stroke}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ filter: isDragging ? `drop-shadow(0 0 6px ${colorMap.glow})` : undefined }}
            className={`${colorMap.stroke} transition-all duration-75 transform rotate-[135deg] origin-center`}
          />

          {/* Live Modulation Arc (if modulated) */}
          {Math.abs(modOffset) > 0.001 && (
            <circle
              cx={dims.diameter / 2}
              cy={dims.diameter / 2}
              r={dims.radius + 3}
              fill="none"
              strokeWidth={1.5}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={modDashoffset}
              strokeLinecap="round"
              className={`${colorMap.modRing} transform rotate-[135deg] origin-center opacity-80 animate-pulse`}
            />
          )}
        </svg>

        {/* Center Knob Cap */}
        <div
          className="absolute rounded-full bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700 shadow-inner flex items-center justify-center"
          style={{
            width: dims.diameter - dims.stroke * 3.5,
            height: dims.diameter - dims.stroke * 3.5,
          }}
        >
          {/* Indicator Needle */}
          <div
            className="w-full h-full relative flex justify-center"
            style={{ transform: `rotate(${currentAngle}deg)` }}
          >
            <div className={`w-[2.5px] h-[35%] rounded-full ${colorMap.dot} shadow-sm mt-1`} />
          </div>

          {/* Center tactile inset */}
          <div className="absolute w-2.5 h-2.5 rounded-full bg-zinc-900 border border-zinc-800" />
        </div>
      </div>

      {/* Label and Value Display */}
      <div className="mt-1 flex flex-col items-center">
        <span className="text-[10px] font-medium text-zinc-400 tracking-wider uppercase truncate max-w-[68px]">
          {label}
        </span>
        <span
          className={`${dims.text} font-mono font-medium ${
            isDragging ? colorMap.accent : 'text-zinc-300'
          }`}
        >
          {formattedDisplay}
        </span>
      </div>
    </div>
  );
};
