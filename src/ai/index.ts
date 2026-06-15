export type {
  Provider,
  ProviderMessage,
  ProviderRequest,
  ProviderResponse,
} from "./types";
export { ProviderError } from "./types";
export { AnthropicProvider } from "./AnthropicProvider";
export {
  getAnthropicKey,
  setAnthropicKey,
  clearAnthropicKey,
  hasAnthropicKey,
  looksLikeAnthropicKey,
  maskKey,
} from "./keystore";
export {
  composeProposal,
  enforceScope,
  parseComposerResponse,
  buildSystemPrompt,
  type ComposerFocus,
  type ComposerRequest,
  type ComposerResult,
  type ComposerError,
  type ComposerProposal,
  type ComposerNewClip,
  type ComposerNewTrack,
  type ComposerModification,
  type ComposerClipChanges,
  type ComposerRecurrence,
} from "./composer";

/** Stable key for indexing per-focus Composer threads in the store. */
export function focusKey(focus: { kind: "new-track" } | { kind: "track"; trackId: string }): string {
  return focus.kind === "new-track" ? "__new-track__" : focus.trackId;
}
