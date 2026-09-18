import { useEffect, useRef, useState } from "react";
import { FONTS, injectFontStylesheet } from "@/fonts/registry";

/**
 * Font dropdown. Each option previews in its own font. Stylesheets are injected
 * on open so we only fetch the fonts the user actually browses.
 */
export function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (family: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      // Warm the fonts shown in the menu.
      FONTS.forEach((f) => injectFontStylesheet(f.family));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Ensure the selected font is loaded for the trigger preview.
  useEffect(() => {
    injectFontStylesheet(value);
  }, [value]);

  return (
    <div className="font-dropdown" ref={ref}>
      <div
        className="btn font-trigger"
        style={{ width: "100%", fontFamily: `"${value}"` }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
        <span style={{ color: "var(--text-faint)", marginLeft: 8 }}>▾</span>
      </div>
      {open && (
        <div className="font-menu">
          {FONTS.map((f) => (
            <div
              key={f.family}
              className={`font-option${f.family === value ? " active" : ""}`}
              style={{ fontFamily: `"${f.family}"` }}
              onClick={() => {
                onChange(f.family);
                setOpen(false);
              }}
            >
              {f.family}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
