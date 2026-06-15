import { describe, it, expect, beforeEach } from "vitest";
import {
  clearAnthropicKey,
  getAnthropicKey,
  hasAnthropicKey,
  looksLikeAnthropicKey,
  maskKey,
  setAnthropicKey,
} from "../keystore";

// jsdom is not configured globally for vitest; provide a minimal localStorage shim.
beforeEach(() => {
  const store = new Map<string, string>();
  const shim = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  (globalThis as unknown as { localStorage: Storage }).localStorage =
    shim as unknown as Storage;
});

describe("keystore", () => {
  it("round-trips set/get", () => {
    setAnthropicKey("sk-ant-abc123abc123");
    expect(getAnthropicKey()).toBe("sk-ant-abc123abc123");
    expect(hasAnthropicKey()).toBe(true);
  });

  it("trims whitespace on set", () => {
    setAnthropicKey("   sk-ant-xyz  ");
    expect(getAnthropicKey()).toBe("sk-ant-xyz");
  });

  it("empty string clears the key", () => {
    setAnthropicKey("sk-ant-abc");
    setAnthropicKey("   ");
    expect(getAnthropicKey()).toBeNull();
  });

  it("clearAnthropicKey removes it", () => {
    setAnthropicKey("sk-ant-abc");
    clearAnthropicKey();
    expect(hasAnthropicKey()).toBe(false);
  });

  it("looksLikeAnthropicKey rejects obvious non-keys", () => {
    expect(looksLikeAnthropicKey("hello")).toBe(false);
    expect(looksLikeAnthropicKey("sk-ant-")).toBe(false);
    expect(looksLikeAnthropicKey("sk-ant-abcdefghij")).toBe(true);
  });

  it("maskKey shows only the last 4 chars after a short prefix", () => {
    expect(maskKey("sk-ant-abcdefghij12345")).toBe("sk-ant-…2345");
    expect(maskKey("short")).toBe("•••••");
  });
});
