export type { StorageAdapter } from "./types";
export { DexieAdapter } from "./DexieAdapter";
export { FakeAdapter } from "./FakeAdapter";

// Singleton accessor — bound from main.tsx once, read by panels/SettingsSheet
// for export/import.
let active: import("./types").StorageAdapter | null = null;
export function setActiveAdapter(a: import("./types").StorageAdapter): void {
  active = a;
}
export function getActiveAdapter(): import("./types").StorageAdapter {
  if (!active) throw new Error("StorageAdapter not initialized");
  return active;
}
