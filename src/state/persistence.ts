// Wires the store to a StorageAdapter: hydrate on boot, save on roadmap change.
// Save is fire-and-forget — failures are warned but don't block UI.

import type { StorageAdapter } from "@/storage";
import { useStore } from "./store";

export function bindPersistence(adapter: StorageAdapter): () => void {
  let cancelled = false;
  let saveQueue: Promise<void> = Promise.resolve();

  void adapter
    .load()
    .then((roadmap) => {
      if (cancelled || !roadmap) {
        // Either disposed already or first run — mark ready with the empty roadmap already in the store.
        useStore.setState({ ready: true });
        return;
      }
      useStore.getState().hydrate(roadmap);
    })
    .catch((err) => {
      console.warn("storage load failed:", err);
      useStore.setState({ ready: true });
    });

  const unsubscribe = useStore.subscribe((state, prev) => {
    if (state.roadmap === prev.roadmap) return;
    if (!state.ready) return; // skip writes during initial hydration
    const snapshot = state.roadmap;
    saveQueue = saveQueue
      .then(() => adapter.save(snapshot))
      .catch((err) => console.warn("storage save failed:", err));
  });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}
