// Provider interface. A Provider is the only piece of the AI stack that knows
// about a specific vendor (Anthropic, OpenAI, Google). Higher-level Composer
// logic (slice 2b) consumes this interface; the rest of the app never imports
// a concrete Provider.

export interface ProviderMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderRequest {
  system: string;
  messages: ProviderMessage[];
  /** Optional model override. Each provider has its own default. */
  model?: string;
  /** Max output tokens. Each provider has its own default. */
  maxTokens?: number;
}

export interface ProviderResponse {
  /** Full text content of the assistant's response. */
  content: string;
  /** Vendor model id that actually served the request. */
  model: string;
  /** Vendor's raw JSON, kept for debugging only. */
  raw?: unknown;
}

export interface Provider {
  /** Short human-readable name, e.g. "Anthropic". */
  readonly name: string;
  message(request: ProviderRequest): Promise<ProviderResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    /** "auth" = bad/missing key. "rate" = throttled. "server" = upstream 5xx. "client" = bad request. "network" = fetch failure. */
    public readonly kind: "auth" | "rate" | "server" | "client" | "network",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
