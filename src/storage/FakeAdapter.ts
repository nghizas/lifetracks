import {
  type Roadmap,
  RoadmapSchema,
  SettingsSchema,
  migrateV2,
  todayStr,
} from "@/core";
import type { StorageAdapter } from "./types";

/** In-memory StorageAdapter for tests and Storybook-like demos. */
export class FakeAdapter implements StorageAdapter {
  private state: Roadmap | null;

  constructor(initial: Roadmap | null = null) {
    this.state = initial;
  }

  async load(): Promise<Roadmap | null> {
    return this.state ? structuredClone(this.state) : null;
  }

  async save(roadmap: Roadmap): Promise<void> {
    this.state = structuredClone(roadmap);
  }

  async exportJSON(): Promise<string> {
    const r =
      this.state ??
      RoadmapSchema.parse({
        version: 3,
        settings: SettingsSchema.parse({}),
        tracks: [],
        clips: [],
      });
    return JSON.stringify(r, null, 2);
  }

  async importJSON(json: string): Promise<Roadmap> {
    const raw = JSON.parse(json) as unknown;
    const roadmap = migrateV2(raw, todayStr());
    await this.save(roadmap);
    return roadmap;
  }
}
