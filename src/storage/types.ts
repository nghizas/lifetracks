// The single seam through which the app touches persistent storage.
// DexieAdapter implements this for the local IndexedDB; FakeAdapter for tests.
// Future SyncAdapter (Phase 4) implements the same interface.

import type { Roadmap } from "@/core";

export interface StorageAdapter {
  /** Returns null when storage is empty (first run). */
  load(): Promise<Roadmap | null>;
  /** Atomically persist the entire roadmap snapshot. */
  save(roadmap: Roadmap): Promise<void>;
  /** Serialise the current persisted state to a JSON string. */
  exportJSON(): Promise<string>;
  /** Parse + migrate a JSON string and persist; returns the resulting roadmap. */
  importJSON(json: string): Promise<Roadmap>;
}
