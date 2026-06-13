// Renders all sheets at the document root level — they read their own
// open/closed state from the store, so only one will actually be visible.

import { EditClipSheet } from "./EditClipSheet";
import { NewClipSheet } from "./NewClipSheet";
import { NewTrackSheet } from "./NewTrackSheet";

export function SheetHost() {
  return (
    <>
      <NewTrackSheet />
      <NewClipSheet />
      <EditClipSheet />
    </>
  );
}
