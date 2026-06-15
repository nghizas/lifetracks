// BYOK key storage. The key stays in localStorage on the user's device and is
// never sent to the Lifetracks origin — it only travels to the vendor API
// when the user actually messages the Composer.

const STORAGE_KEY = "lifetracks.anthropic-key";

export function getAnthropicKey(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setAnthropicKey(key: string): void {
  const trimmed = key.trim();
  try {
    if (trimmed.length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    /* noop */
  }
}

export function clearAnthropicKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function hasAnthropicKey(): boolean {
  return getAnthropicKey() !== null;
}

/** Best-effort "looks like an Anthropic key" check (prefix sk-ant-…). */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[a-zA-Z0-9_-]{10,}$/.test(key.trim());
}

/** Mask all but the last 4 chars for display. */
export function maskKey(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return "•".repeat(t.length);
  return `${t.slice(0, 7)}…${t.slice(-4)}`;
}
