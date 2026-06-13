/** Collision-resistant id. Prefers `crypto.randomUUID()`; falls back to Math.random. */
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && "randomUUID" in c) return c.randomUUID();
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 8)
  );
}
