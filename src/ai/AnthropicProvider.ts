// Anthropic Messages API adapter. BYOK from the browser using the
// `anthropic-dangerous-direct-browser-access` header (this is the official
// path for trusted browser-side use with the user's own key).

import {
  type Provider,
  type ProviderRequest,
  type ProviderResponse,
  ProviderError,
} from "./types";

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponseBody {
  id?: string;
  model?: string;
  content?: AnthropicContentBlock[];
  error?: { type?: string; message?: string };
}

interface Options {
  apiKey: string;
  /** Inject a custom fetcher for tests. Defaults to global fetch. */
  fetcher?: typeof fetch;
  /** Default model id. Override in `message({ model })` per-call. */
  defaultModel?: string;
  /** Default max tokens. Override in `message({ maxTokens })` per-call. */
  defaultMaxTokens?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_MAX_TOKENS = 4096;
const API_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements Provider {
  readonly name = "Anthropic";
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;
  private readonly defaultModel: string;
  private readonly defaultMaxTokens: number;

  constructor(opts: Options) {
    this.apiKey = opts.apiKey;
    this.fetcher = opts.fetcher ?? fetch.bind(globalThis);
    this.defaultModel = opts.defaultModel ?? DEFAULT_MODEL;
    this.defaultMaxTokens = opts.defaultMaxTokens ?? DEFAULT_MAX_TOKENS;
  }

  async message(request: ProviderRequest): Promise<ProviderResponse> {
    const body = {
      model: request.model ?? this.defaultModel,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      system: request.system,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    let res: Response;
    try {
      res = await this.fetcher(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new ProviderError(
        `Network error reaching Anthropic: ${(err as Error).message}`,
        "network",
      );
    }

    const text = await res.text();
    let parsed: AnthropicResponseBody;
    try {
      parsed = JSON.parse(text) as AnthropicResponseBody;
    } catch {
      throw new ProviderError(
        `Anthropic returned non-JSON (${res.status}): ${text.slice(0, 200)}`,
        res.status >= 500 ? "server" : "client",
        res.status,
      );
    }

    if (!res.ok) {
      const msg = parsed.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError(`Auth failed: ${msg}`, "auth", res.status);
      }
      if (res.status === 429) {
        throw new ProviderError(`Rate limited: ${msg}`, "rate", res.status);
      }
      if (res.status >= 500) {
        throw new ProviderError(`Anthropic server error: ${msg}`, "server", res.status);
      }
      throw new ProviderError(`Anthropic API: ${msg}`, "client", res.status);
    }

    const content =
      parsed.content
        ?.filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text!)
        .join("") ?? "";

    return {
      content,
      model: parsed.model ?? body.model,
      raw: parsed,
    };
  }
}
