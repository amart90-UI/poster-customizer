import { useState } from "react";
import { useEditor } from "@/store/store";
import { docDimensions } from "@/model/poster";
import { layoutText } from "@/render/textLayout";
import { centerBox } from "@/render/snapping";
import { FONT_MAP } from "@/fonts/registry";
import { ColorField, Section, Slider, Toggle } from "@/components/ui";
import { FontPicker } from "@/components/FontPicker";
import type { TextAlign, TextObject } from "@/types";

export function TypographyPanel() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedIds[0]);
  const updateText = useEditor((s) => s.updateText);
  const endCoalesce = useEditor((s) => s.endCoalesce);
  const removeText = useEditor((s) => s.removeText);
  const duplicateText = useEditor((s) => s.duplicateText);
  const bringToFront = useEditor((s) => s.bringToFront);
  const sendToBack = useEditor((s) => s.sendToBack);
  const addText = useEditor((s) => s.addText);

  const [showEffects, setShowEffects] = useState(false);

  const t = project.texts.find((x) => x.id === selectedId);

  if (!t) {
    return (
      <Section title="Text">
        <button className="btn primary" style={{ width: "100%" }} onClick={() => addText()}>
          + Add text
        </button>
        <p className="hint" style={{ marginTop: 10 }}>
          Add text, then double-click it on the poster to edit. Drag to move,
          use the side handles to resize, and the top handle to rotate.
        </p>
      </Section>
    );
  }

  const set = (patch: Partial<TextObject>, coalesce?: string) => updateText(t.id, patch, coalesce);
  const weights = FONT_MAP[t.fontFamily]?.weights ?? [400, 700];
  const doc = docDimensions(project.size);
  const layout = layoutText(t);

  const align = (a: TextAlign) => set({ align: a });

  const centerH = () => {
    const c = centerBox(t, layout.height, doc.width, doc.height, "h");
    set(c);
  };
  const centerV = () => {
    const c = centerBox(t, layout.height, doc.width, doc.height, "v");
    set(c);
  };

  /**
   * Fit text: scale the font size so the widest current line fits the box
   * width. Explicit, one-shot — nothing auto-resizes afterward.
   */
  const fitText = () => {
    const widest = Math.max(...layout.lines.map((l) => l.width), 1);
    if (widest <= 0) return;
    const ratio = t.width / widest;
    const newSize = Math.max(8, Math.min(2000, Math.round(t.fontSize * ratio)));
    set({ fontSize: newSize });
  };

  return (
    <>
      <Section title="Text">
        <div className="field">
          <textarea
            value={t.text}
            rows={2}
            onChange={(e) => set({ text: e.target.value }, `text-${t.id}`)}
            onBlur={endCoalesce}
          />
        </div>
        <div className="field">
          <FontPicker value={t.fontFamily} onChange={(family) => set({ fontFamily: family })} />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>Weight</label>
            <select
              value={t.fontWeight}
              onChange={(e) => set({ fontWeight: Number(e.target.value) })}
            >
              {weights.map((w) => (
                <option key={w} value={w}>
                  {weightLabel(w)}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ width: 96, marginBottom: 0 }}>
            <label>Color</label>
            <ColorField value={t.color} onChange={(v) => set({ color: v }, `color-${t.id}`)} onCommit={endCoalesce} />
          </div>
        </div>
      </Section>

      <Section title="Style">
        <Slider
          label="Size"
          value={t.fontSize}
          min={8}
          max={Math.round(Math.min(doc.width, doc.height) * 0.6)}
          onChange={(v) => set({ fontSize: v }, `size-${t.id}`)}
          onCommit={endCoalesce}
          suffix="px"
        />
        <Slider
          label="Line height"
          value={t.lineHeight * 100}
          min={80}
          max={250}
          onChange={(v) => set({ lineHeight: v / 100 }, `lh-${t.id}`)}
          onCommit={endCoalesce}
          suffix="%"
        />
        <Slider
          label="Letter spacing"
          value={t.letterSpacing}
          min={-20}
          max={60}
          onChange={(v) => set({ letterSpacing: v }, `ls-${t.id}`)}
          onCommit={endCoalesce}
        />
        <div className="field">
          <label>Alignment</label>
          <div className="seg">
            {(["left", "center", "right"] as TextAlign[]).map((a) => (
              <button key={a} className={t.align === a ? "active" : ""} onClick={() => align(a)}>
                {a === "left" ? "⇤" : a === "center" ? "≡" : "⇥"}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ marginBottom: 4 }}>
          <Toggle label="Italic" checked={t.italic} onChange={(v) => set({ italic: v })} />
        </div>
        <div className="row">
          <Toggle label="Uppercase" checked={t.uppercase} onChange={(v) => set({ uppercase: v })} />
        </div>
      </Section>

      <Section title="Arrange">
        <div className="row wrap">
          <button className="btn" onClick={centerH}>Center H</button>
          <button className="btn" onClick={centerV}>Center V</button>
          <button className="btn" onClick={fitText}>Fit width</button>
        </div>
        <div className="row wrap" style={{ marginTop: 8 }}>
          <button className="btn" onClick={() => bringToFront(t.id)}>Front</button>
          <button className="btn" onClick={() => sendToBack(t.id)}>Back</button>
          <button className="btn" onClick={() => duplicateText(t.id)}>Duplicate</button>
        </div>
        <Slider
          label="Rotation"
          value={t.rotation}
          min={-180}
          max={180}
          onChange={(v) => set({ rotation: v }, `rot-${t.id}`)}
          onCommit={endCoalesce}
          suffix="°"
        />
      </Section>

      <Section title="Effects">
        <button
          className="btn"
          style={{ width: "100%", marginBottom: showEffects ? 12 : 0 }}
          onClick={() => setShowEffects((s) => !s)}
        >
          {showEffects ? "Hide effects" : "Shadow, outline & background"}
        </button>

        {showEffects && (
          <>
            <div className="field">
              <Toggle
                label="Shadow"
                checked={t.effects.shadow.enabled}
                onChange={(v) => set({ effects: { ...t.effects, shadow: { ...t.effects.shadow, enabled: v } } })}
              />
              {t.effects.shadow.enabled && (
                <div style={{ marginTop: 8 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <ColorField
                      value={t.effects.shadow.color}
                      onChange={(v) => set({ effects: { ...t.effects, shadow: { ...t.effects.shadow, color: v } } }, `sh-c-${t.id}`)}
                      onCommit={endCoalesce}
                    />
                    <span className="hint">Shadow color</span>
                  </div>
                  <Slider
                    label="Blur"
                    value={t.effects.shadow.blur}
                    min={0}
                    max={80}
                    onChange={(v) => set({ effects: { ...t.effects, shadow: { ...t.effects.shadow, blur: v } } }, `sh-b-${t.id}`)}
                    onCommit={endCoalesce}
                  />
                  <Slider
                    label="Offset Y"
                    value={t.effects.shadow.offsetY}
                    min={-60}
                    max={60}
                    onChange={(v) => set({ effects: { ...t.effects, shadow: { ...t.effects.shadow, offsetY: v } } }, `sh-y-${t.id}`)}
                    onCommit={endCoalesce}
                  />
                </div>
              )}
            </div>

            <div className="field">
              <Toggle
                label="Outline"
                checked={t.effects.outline.enabled}
                onChange={(v) => set({ effects: { ...t.effects, outline: { ...t.effects.outline, enabled: v } } })}
              />
              {t.effects.outline.enabled && (
                <div style={{ marginTop: 8 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <ColorField
                      value={t.effects.outline.color}
                      onChange={(v) => set({ effects: { ...t.effects, outline: { ...t.effects.outline, color: v } } }, `ol-c-${t.id}`)}
                      onCommit={endCoalesce}
                    />
                    <span className="hint">Outline color</span>
                  </div>
                  <Slider
                    label="Width"
                    value={t.effects.outline.width}
                    min={1}
                    max={30}
                    onChange={(v) => set({ effects: { ...t.effects, outline: { ...t.effects.outline, width: v } } }, `ol-w-${t.id}`)}
                    onCommit={endCoalesce}
                  />
                </div>
              )}
            </div>

            <div className="field">
              <Toggle
                label="Background"
                checked={t.effects.background.enabled}
                onChange={(v) => set({ effects: { ...t.effects, background: { ...t.effects.background, enabled: v } } })}
              />
              {t.effects.background.enabled && (
                <div style={{ marginTop: 8 }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <ColorField
                      value={t.effects.background.color}
                      onChange={(v) => set({ effects: { ...t.effects, background: { ...t.effects.background, color: v } } }, `bg-c-${t.id}`)}
                      onCommit={endCoalesce}
                    />
                    <span className="hint">Background color</span>
                  </div>
                  <Slider
                    label="Padding"
                    value={t.effects.background.padding}
                    min={0}
                    max={80}
                    onChange={(v) => set({ effects: { ...t.effects, background: { ...t.effects.background, padding: v } } }, `bg-p-${t.id}`)}
                    onCommit={endCoalesce}
                  />
                  <Slider
                    label="Corner radius"
                    value={t.effects.background.radius}
                    min={0}
                    max={80}
                    onChange={(v) => set({ effects: { ...t.effects, background: { ...t.effects.background, radius: v } } }, `bg-r-${t.id}`)}
                    onCommit={endCoalesce}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      <Section title="">
        <button className="btn danger" style={{ width: "100%" }} onClick={() => removeText(t.id)}>
          Delete text
        </button>
      </Section>
    </>
  );
}

function weightLabel(w: number): string {
  const map: Record<number, string> = {
    100: "Thin",
    200: "Extra Light",
    300: "Light",
    400: "Regular",
    500: "Medium",
    600: "Semibold",
    700: "Bold",
    800: "Extrabold",
    900: "Black",
  };
  return map[w] ? `${map[w]} (${w})` : String(w);
}
