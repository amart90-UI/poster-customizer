import type { Project, ProjectFile } from "@/types";
import { idbDelete, idbGet, idbPut } from "@/store/idb";

/**
 * Local persistence.
 *
 * Full projects (which embed the background image as a data URL and can be
 * several megabytes) are stored in IndexedDB, whose quota is large enough for
 * real images. A small metadata index and the "active project" pointer stay in
 * localStorage: they're tiny, and synchronous access keeps startup simple.
 *
 * Everything is local — no account, no server.
 */

const KEY_INDEX = "poster:index";
const KEY_ACTIVE = "poster:active";
const KEY_MIGRATED = "poster:migrated-to-idb";
/** Legacy localStorage key for full projects (pre-IndexedDB). */
const LEGACY_KEY_PROJECT = (id: string) => `poster:project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

// ---------- metadata index (localStorage) ----------

function readIndex(): ProjectMeta[] {
  try {
    const raw = localStorage.getItem(KEY_INDEX);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProjectMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index: ProjectMeta[]) {
  localStorage.setItem(KEY_INDEX, JSON.stringify(index));
}

export function listProjects(): ProjectMeta[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(KEY_ACTIVE);
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(KEY_ACTIVE, id);
  else localStorage.removeItem(KEY_ACTIVE);
}

// ---------- full projects (IndexedDB) ----------

export class QuotaError extends Error {}

function isQuota(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

export async function loadProjectById(id: string): Promise<Project | null> {
  try {
    const p = await idbGet<Project>(id);
    if (p) return p;
  } catch {
    // fall through to legacy lookup
  }
  // Fallback: a project that hasn't been migrated yet may still be in
  // localStorage. Read it if present.
  try {
    const raw = localStorage.getItem(LEGACY_KEY_PROJECT(id));
    if (raw) return JSON.parse(raw) as Project;
  } catch {
    /* ignore */
  }
  return null;
}

/** Persist a project (IndexedDB) and update the index. Throws QuotaError if full. */
export async function saveProject(project: Project): Promise<void> {
  try {
    await idbPut<Project>(project.id, project);
  } catch (err) {
    if (isQuota(err)) {
      throw new QuotaError(
        "Storage is full. Your project could not be saved. Try a smaller image or remove old projects.",
      );
    }
    throw err;
  }

  const index = readIndex().filter((m) => m.id !== project.id);
  index.push({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  });
  writeIndex(index);
  setActiveProjectId(project.id);
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await idbDelete(id);
  } catch {
    /* ignore */
  }
  // Remove any lingering legacy copy too.
  try {
    localStorage.removeItem(LEGACY_KEY_PROJECT(id));
  } catch {
    /* ignore */
  }
  writeIndex(readIndex().filter((m) => m.id !== id));
  if (getActiveProjectId() === id) setActiveProjectId(null);
}

/**
 * One-time migration of any projects previously stored in localStorage into
 * IndexedDB. Safe to call on every startup; it no-ops after the first run.
 */
export async function migrateLegacyProjects(): Promise<void> {
  if (localStorage.getItem(KEY_MIGRATED) === "1") return;

  const index = readIndex();
  for (const meta of index) {
    const legacyKey = LEGACY_KEY_PROJECT(meta.id);
    const raw = localStorage.getItem(legacyKey);
    if (!raw) continue;
    try {
      const project = JSON.parse(raw) as Project;
      await idbPut<Project>(project.id, project);
      localStorage.removeItem(legacyKey);
    } catch {
      // If a single project fails to migrate, leave it in place and continue.
    }
  }

  localStorage.setItem(KEY_MIGRATED, "1");
}

// ---------- import / export ----------

/** Serialize a project to a downloadable file blob. */
export function projectToFile(project: Project): Blob {
  const file: ProjectFile = { kind: "poster-project", version: 1, project };
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
}

/** Parse an imported project file. Throws on invalid shape. */
export function parseProjectFile(text: string): Project {
  const data = JSON.parse(text) as Partial<ProjectFile>;
  if (!data || data.kind !== "poster-project" || !data.project) {
    throw new Error("This file is not a valid poster project.");
  }
  const p = data.project as Project;
  if (!p.id || !p.size || !Array.isArray(p.texts)) {
    throw new Error("This project file is missing required fields.");
  }
  return p;
}
