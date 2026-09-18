import type { Project, ProjectFile } from "@/types";

/**
 * Local persistence.
 *
 * Projects live in localStorage under a per-project key, plus an index of
 * metadata for the project list. An "active project" pointer lets us restore
 * exactly what the user was working on after a refresh. Everything is local:
 * no account, no server.
 *
 * localStorage is synchronous and size-limited (~5MB). Since projects embed the
 * image as a data URL, a very large image could exceed the quota; writes are
 * wrapped so a quota failure surfaces to the UI instead of throwing silently.
 */

const KEY_INDEX = "poster:index";
const KEY_ACTIVE = "poster:active";
const KEY_PROJECT = (id: string) => `poster:project:${id}`;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
}

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

export function loadProjectById(id: string): Project | null {
  try {
    const raw = localStorage.getItem(KEY_PROJECT(id));
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export class QuotaError extends Error {}

/** Persist a project and update the index. Throws QuotaError if storage full. */
export function saveProject(project: Project): void {
  try {
    localStorage.setItem(KEY_PROJECT(project.id), JSON.stringify(project));
  } catch (err) {
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
      throw new QuotaError("Local storage is full. Your project could not be saved automatically.");
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

export function deleteProject(id: string): void {
  localStorage.removeItem(KEY_PROJECT(id));
  writeIndex(readIndex().filter((m) => m.id !== id));
  if (getActiveProjectId() === id) setActiveProjectId(null);
}

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
