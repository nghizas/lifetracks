// Renders all sheets at the document root level — they read their own
// open/closed state from the store, so only one will actually be visible.

import { ComposerSheet } from "./ComposerSheet";
import { EditClipSheet } from "./EditClipSheet";
import { EditTrackSheet } from "./EditTrackSheet";
import { NewClipSheet } from "./NewClipSheet";
import { NewTrackSheet } from "./NewTrackSheet";
import { SettingsSheet } from "./SettingsSheet";

export function SheetHost() {
  return (
    <>
      <NewTrackSheet />
      <NewClipSheet />
      <EditClipSheet />
      <EditTrackSheet />
      <ComposerSheet />
      <SettingsSheet />
    </>
  );
}
