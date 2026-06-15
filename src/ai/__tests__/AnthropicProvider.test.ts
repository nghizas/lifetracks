import { describe, it, expect, vi } from "vitest";
import { AnthropicProvider } from "../AnthropicProvider";
import { ProviderError } from "../types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AnthropicProvider", () => {
  it("sends the expected POST and parses a normal response", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        id: "msg_1",
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "Hello." }],
      }),
    );
    const provider = new AnthropicProvider({ apiKey: "sk-ant-test", fetcher: fetcher as unknown as typeof fetch });

    const res = await provider.message({
      system: "You are a calm planning assistant.",
      messages: [{ role: "user", content: "Hi." }],
    });

    expect(res.content).toBe("Hello.");
    expect(res.model).toBe("claude-sonnet-4-6");

    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("https://api.anthropic.com/v1/messages");
    const headers = call[1].headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    const body = JSON.parse(call[1].body as string) as {
      model: string;
      system: string;
      messages: { role: string; content: string }[];
    };
    expect(body.system).toBe("You are a calm planning assistant.");
    expect(body.messages[0]).toEqual({ role: "user", content: "Hi." });
  });

  it("concatenates multiple text content blocks", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        model: "claude-sonnet-4-6",
        content: [
          { type: "text", text: "First. " },
          { type: "text", text: "Second." },
        ],
      }),
    );
    const provider = new AnthropicProvider({ apiKey: "sk-ant-x", fetcher: fetcher as unknown as typeof fetch });
    const res = await provider.message({ system: "x", messages: [{ role: "user", content: "x" }] });
    expect(res.content).toBe("First. Second.");
  });

  it("throws ProviderError(auth) on 401", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: { type: "auth", message: "invalid key" } }, 401),
    );
    const provider = new AnthropicProvider({ apiKey: "bad", fetcher: fetcher as unknown as typeof fetch });
    await expect(
      provider.message({ system: "x", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ kind: "auth", status: 401 });
  });

  it("throws ProviderError(rate) on 429", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: { type: "rate_limit", message: "slow down" } }, 429),
    );
    const provider = new AnthropicProvider({ apiKey: "k", fetcher: fetcher as unknown as typeof fetch });
    await expect(
      provider.message({ system: "x", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ kind: "rate", status: 429 });
  });

  it("throws ProviderError(server) on 500", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: { message: "boom" } }, 503),
    );
    const provider = new AnthropicProvider({ apiKey: "k", fetcher: fetcher as unknown as typeof fetch });
    await expect(
      provider.message({ system: "x", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ kind: "server", status: 503 });
  });

  it("wraps fetch failures as ProviderError(network)", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("connection reset");
    });
    const provider = new AnthropicProvider({ apiKey: "k", fetcher: fetcher as unknown as typeof fetch });
    const err = await provider
      .message({ system: "x", messages: [{ role: "user", content: "x" }] })
      .catch((e: ProviderError) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("network");
  });
});
