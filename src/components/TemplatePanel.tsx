import { useEditor } from "@/store/store";
import { docDimensions } from "@/model/poster";
import { HOSS_TEMPLATE } from "@/templates/registry";
import { Section, Toggle } from "@/components/ui";
import { makeSize } from "@/model/poster";

/**
 * Template picker for the built-in "Hoss" poster.
 *
 * Layout mirrors how the layers correspond: a Background toggle on top, then a
 * Figures row and a Logos row whose columns (1 / 2 / 3) line up. Figures and
 * logos are linked by default (picking a figure sets its matching logo and
 * vice versa) but each can be changed independently, and each can be turned
 * off ("none").
 */
export function TemplatePanel() {
  const template = HOSS_TEMPLATE;
  const project = useEditor((s) => s.project);
  const setSize = useEditor((s) => s.setSize);
  const setTemplateBackground = useEditor((s) => s.setTemplateBackground);
  const setTemplateFigures = useEditor((s) => s.setTemplateFigures);
  const setTemplateLogo = useEditor((s) => s.setTemplateLogo);

  const state = project.template?.templateId === template.id ? project.template : null;
  const bgOn = state?.background ?? false;
  const activeFigure = state?.figures ?? null;
  const activeLogo = state?.logo ?? null;
  const anyActive = bgOn || activeFigure != null || activeLogo != null;

  // When first enabling the template on a fresh/empty project, adopt the
  // template's suggested poster size so the artwork isn't distorted.
  const maybeAdoptSize = () => {
    if (anyActive) return;
    const s = template.suggestedSize;
    const isEmpty = !project.image && project.texts.length === 0;
    if (s && isEmpty) {
      setSize(makeSize("custom", s.widthInches, s.heightInches, project.size.dpi));
    }
  };

  const toggleBackground = (on: boolean) => {
    if (on) maybeAdoptSize();
    setTemplateBackground(template.id, on);
  };

  const pickFigure = (id: string) => {
    maybeAdoptSize();
    // Toggle off if already selected.
    setTemplateFigures(template.id, activeFigure === id ? null : id);
  };

  const pickLogo = (id: string) => {
    maybeAdoptSize();
    setTemplateLogo(template.id, activeLogo === id ? null : id);
  };

  return (
    <Section title={template.name}>
      <div className="toggle-row" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 13 }}>{template.background.label} (background)</span>
        <span style={{ display: "inline-flex" }}>
          <Toggle label="" checked={bgOn} onChange={toggleBackground} />
        </span>
      </div>

      {/* Aligned grid: header row of numbers, then Figures row, then Logos row. */}
      <div className="template-grid">
        <div className="tg-label" />
        {template.figures.map((f) => (
          <div key={`h-${f.column}`} className="tg-head">
            {f.column}
          </div>
        ))}

        <div className="tg-label">Figures</div>
        {template.figures.map((f) => (
          <button
            key={f.id}
            className={`btn tg-cell${activeFigure === f.id ? " primary" : ""}`}
            onClick={() => pickFigure(f.id)}
            title={f.label}
          >
            {f.label}
          </button>
        ))}

        <div className="tg-label">Logo</div>
        {template.logos.map((l) => (
          <button
            key={l.id}
            className={`btn tg-cell${activeLogo === l.id ? " primary" : ""}`}
            onClick={() => pickLogo(l.id)}
            title={l.label}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 10 }}>
        Figures and logo are linked by number, but you can mix them or turn any
        off. Click a selected option again to clear it. Add your own text on top.
      </p>

      {(activeFigure != null || activeLogo != null || bgOn) && (
        <button
          className="btn"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => {
            setTemplateBackground(template.id, false);
            setTemplateFigures(template.id, null);
            setTemplateLogo(template.id, null);
          }}
        >
          Clear template
        </button>
      )}

      <p className="hint" style={{ marginTop: 8 }}>
        {(() => {
          const d = docDimensions(project.size);
          return `Artwork is portrait ${template.canvasWidth}×${template.canvasHeight}; current poster ${d.width}×${d.height}px.`;
        })()}
      </p>
    </Section>
  );
}
