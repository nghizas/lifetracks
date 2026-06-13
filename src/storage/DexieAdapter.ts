import Dexie, { type Table } from "dexie";
import {
  type Clip,
  type Roadmap,
  type Settings,
  type Track,
  RoadmapSchema,
  SettingsSchema,
  migrateV2,
  todayStr,
} from "@/core";
import type { StorageAdapter } from "./types";

interface SettingsRow extends Settings {
  id: "current";
}

class LifetracksDB extends Dexie {
  tracks!: Table<Track, string>;
  clips!: Table<Clip, string>;
  settings!: Table<SettingsRow, string>;

  constructor() {
    super("lifetracks");
    this.version(1).stores({
      tracks: "id, order, updatedAt",
      clips: "id, trackId, kind, updatedAt",
      settings: "id",
    });
  }
}

export class DexieAdapter implements StorageAdapter {
  private db = new LifetracksDB();

  async load(): Promise<Roadmap | null> {
    const [tracks, clips, settingsRow] = await Promise.all([
      this.db.tracks.toArray(),
      this.db.clips.toArray(),
      this.db.settings.get("current"),
    ]);
    if (!settingsRow && tracks.length === 0 && clips.length === 0) return null;
    const settings: Settings = settingsRow
      ? stripId(settingsRow)
      : SettingsSchema.parse({});
    return RoadmapSchema.parse({ version: 3, settings, tracks, clips });
  }

  async save(roadmap: Roadmap): Promise<void> {
    await this.db.transaction(
      "rw",
      this.db.tracks,
      this.db.clips,
      this.db.settings,
      async () => {
        await this.db.tracks.clear();
        await this.db.clips.clear();
        await this.db.settings.clear();
        await this.db.tracks.bulkPut(roadmap.tracks);
        await this.db.clips.bulkPut(roadmap.clips);
        await this.db.settings.put({ ...roadmap.settings, id: "current" });
      },
    );
  }

  async exportJSON(): Promise<string> {
    const roadmap = (await this.load()) ?? {
      version: 3 as const,
      settings: SettingsSchema.parse({}),
      tracks: [],
      clips: [],
    };
    return JSON.stringify(roadmap, null, 2);
  }

  async importJSON(json: string): Promise<Roadmap> {
    const raw = JSON.parse(json) as unknown;
    const roadmap = migrateV2(raw, todayStr());
    await this.save(roadmap);
    return roadmap;
  }
}

function stripId(row: SettingsRow): Settings {
  // Pull id out without an unused binding.
  const settings: Settings = {
    apiKey: row.apiKey,
    horizonYears: row.horizonYears,
    monthlyCapacity: row.monthlyCapacity,
    lookaheadDays: row.lookaheadDays,
  };
  return settings;
}
