import type { ReactNode } from "react";

/** A labeled color input styled as a swatch. */
export function ColorField({
  value,
  onChange,
  onCommit,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: () => void;
}) {
  return (
    <span className="color-swatch" title={value}>
      <input
        type="color"
        value={value.length === 7 ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
      />
    </span>
  );
}

/** A toggle switch with a label. */
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span style={{ fontSize: 13 }}>{label}</span>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track" />
        <span className="thumb" />
      </label>
    </div>
  );
}

/** A slider with a numeric readout. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="field">
      <label>
        {label}
        <span style={{ float: "right", color: "var(--text-faint)" }}>
          {Math.round(value)}
          {suffix}
        </span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="panel-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
