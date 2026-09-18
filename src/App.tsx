import { useEffect, useState } from "react";
import { useEditor } from "@/store/store";
import {
  getActiveProjectId,
  loadProjectById,
  migrateLegacyProjects,
} from "@/store/persistence";
import { useAutosave } from "@/hooks/useAutosave";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Topbar } from "@/components/Topbar";
import { Stage } from "@/components/Stage";
import { TypographyPanel } from "@/components/TypographyPanel";
import { PosterPanel } from "@/components/PosterPanel";
import { TemplatePanel } from "@/components/TemplatePanel";
import { ExportDialog } from "@/components/ExportDialog";
import { ProjectsDialog } from "@/components/ProjectsDialog";
import { Toasts } from "@/components/Toasts";

type MobileTab = "poster" | "text";

export default function App() {
  const loadProject = useEditor((s) => s.loadProject);
  const hasImage = useEditor((s) => s.project.image != null);
  const hasText = useEditor((s) => s.project.texts.length > 0);
  const hasTemplate = useEditor((s) => {
    const t = s.project.template;
    return !!t && (t.background || t.figures != null || t.logo != null);
  });
  const selectedId = useEditor((s) => s.selectedIds[0]);
  const addText = useEditor((s) => s.addText);

  const [showExport, setShowExport] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("poster");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useAutosave();
  useKeyboard();

  // Migrate any legacy localStorage projects into IndexedDB, then restore the
  // last active project. Runs once on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await migrateLegacyProjects();
      const id = getActiveProjectId();
      if (!id) return;
      const p = await loadProjectById(id);
      if (p && !cancelled) loadProject(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProject]);

  // When a text object is selected, default the mobile panel to the text tab.
  useEffect(() => {
    if (selectedId) {
      setMobileTab("text");
      setSidebarOpen(true);
    }
  }, [selectedId]);

  const showEmptyHint = !hasImage && !hasText && !hasTemplate;

  return (
    <div className="app">
      <Topbar onOpenProjects={() => setShowProjects(true)} onOpenExport={() => setShowExport(true)} />

      <div className="body">
        <div className="stage-wrap-outer" style={{ flex: 1, position: "relative", display: "flex", minWidth: 0 }}>
          <Stage />
          {showEmptyHint && (
            <div
              className="empty-state"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <h2>Start your poster</h2>
              <p>
                Upload a background image, then add text. Drag to position, style
                the type, and export when it looks right.
              </p>
              <div className="row" style={{ pointerEvents: "auto" }}>
                <button className="btn primary" onClick={() => addText()}>+ Add text</button>
              </div>
            </div>
          )}
        </div>

        <aside className={`sidebar${sidebarOpen ? "" : " collapsed"}`}>
          <MobilePanel tab={mobileTab} />
        </aside>
      </div>

      <div className="mobile-tabs">
        <button
          className={sidebarOpen && mobileTab === "poster" ? "active" : ""}
          onClick={() => {
            setMobileTab("poster");
            setSidebarOpen(true);
          }}
        >
          Poster
        </button>
        <button
          className={sidebarOpen && mobileTab === "text" ? "active" : ""}
          onClick={() => {
            setMobileTab("text");
            setSidebarOpen(true);
          }}
        >
          Text
        </button>
        <button className={!sidebarOpen ? "active" : ""} onClick={() => setSidebarOpen((o) => !o)}>
          {sidebarOpen ? "Hide" : "Show"}
        </button>
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showProjects && <ProjectsDialog onClose={() => setShowProjects(false)} />}
      <Toasts />
    </div>
  );
}

/**
 * On desktop both panels stack in the sidebar. On mobile the tab picks one to
 * show. We render both on wide screens (CSS handles it) but to keep it simple
 * and predictable we render both always; the mobile tab scrolls to the right
 * section by ordering.
 */
function MobilePanel({ tab }: { tab: MobileTab }) {
  // On desktop, show typography then poster settings. On mobile the active tab
  // determines which panel is shown.
  const isMobile = useMediaQuery("(max-width: 760px)");

  if (isMobile) {
    return tab === "poster" ? (
      <>
        <TemplatePanel />
        <PosterPanel />
      </>
    ) : (
      <TypographyPanel />
    );
  }
  return (
    <>
      <TemplatePanel />
      <TypographyPanel />
      <PosterPanel />
    </>
  );
}
