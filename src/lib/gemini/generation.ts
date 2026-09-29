import type { ZodType } from 'zod';

/**
 * Provider-agnostic request used by every Vstyle Gemini task.
 * The concrete provider (see ./provider.ts) maps it onto the Gemini Interactions API,
 * tests use an in-memory fake with the same shape.
 */
export type GeminiThinkingLevel = 'low' | 'medium' | 'high';

export interface InlineImage {
  /** e.g. image/jpeg, image/png, image/webp */
  mimeType: string;
  /** base64 without the data: prefix */
  data: string;
}

export interface GeminiGenerationRequest {
  model: string;
  prompt: string;
  systemInstruction?: string;
  images?: InlineImage[];
  /** JSON Schema (Gemini supported subset) used for constrained decoding. */
  responseJsonSchema?: Record<string, unknown>;
  thinkingLevel?: GeminiThinkingLevel;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface GeminiTextProvider {
  generateContent(request: GeminiGenerationRequest): Promise<{ text?: string | null }>;
}

export interface GeminiImageRequest {
  model: string;
  prompt: string;
  images?: InlineImage[];
  aspectRatio?: '1:1' | '3:4' | '4:5' | '9:16';
  abortSignal?: AbortSignal;
}

export interface GeneratedImage {
  mimeType: string;
  data: string;
}

export interface GeminiImageProvider {
  generateImage(request: GeminiImageRequest): Promise<GeneratedImage | null>;
}

export type GeminiFailureKind =
  | 'not_configured'
  | 'authentication'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'empty_response'
  | 'invalid_json'
  | 'schema_mismatch'
  | 'invalid_ids'
  | 'safety'
  | 'provider';

export interface StructuredGenerationResult<T> {
  value: T;
  usedFallback: boolean;
  failureKind?: GeminiFailureKind;
}

export interface StructuredGenerationOptions<T> {
  provider?: GeminiTextProvider;
  model: string;
  systemInstruction: string;
  prompt: string;
  schema: ZodType<T>;
  /** Optional JSON schema sent to Gemini for constrained decoding; zod still validates the result. */
  jsonSchema?: Record<string, unknown>;
  images?: InlineImage[];
  thinkingLevel?: GeminiThinkingLevel;
  fallback: () => T;
  validate?: (value: T) => boolean;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxOutputTokens?: number;
}

class InvalidModelOutputError extends Error {
  failureKind: 'empty_response' | 'invalid_json' | 'schema_mismatch' | 'invalid_ids';

  constructor(failureKind: 'empty_response' | 'invalid_json' | 'schema_mismatch' | 'invalid_ids') {
    super(failureKind);
    this.name = 'InvalidModelOutputError';
    this.failureKind = failureKind;
  }
}

class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini request timed out');
    this.name = 'GeminiTimeoutError';
  }
}

export function statusCodeFrom(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown; response?: { status?: unknown } };
  for (const value of [candidate.status, candidate.statusCode, candidate.response?.status]) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\d{3}$/.test(value)) return Number(value);
  }
  if (candidate.code === 'UNAUTHENTICATED') return 401;
  if (candidate.code === 'PERMISSION_DENIED') return 403;
  if (candidate.code === 'RESOURCE_EXHAUSTED') return 429;
  return undefined;
}

export function failureKindFrom(error: unknown): GeminiFailureKind {
  if (error instanceof InvalidModelOutputError) return error.failureKind;
  if (error instanceof GeminiTimeoutError || (error instanceof Error && error.name === 'AbortError')) return 'timeout';
  const status = statusCodeFrom(error);
  if (status === 401 || status === 403) return 'authentication';
  if (status === 429) return 'rate_limit';
  if (error instanceof Error && /safety|blocked|prohibited/i.test(error.message)) return 'safety';
  if (error instanceof TypeError) return 'network';
  return 'provider';
}

/** Runs any provider call with a hard timeout that also aborts the underlying request. */
export async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new GeminiTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/** Removes Markdown code fences that some models wrap around JSON. */
export function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function generateStructuredJson<T>(
  options: StructuredGenerationOptions<T>,
): Promise<StructuredGenerationResult<T>> {
  if (!options.provider || !options.model.trim()) {
    return { value: options.fallback(), usedFallback: true, failureKind: 'not_configured' };
  }

  const retries = Math.max(0, Math.min(options.retries ?? 1, 1));
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let finalFailure: GeminiFailureKind = 'provider';
  let sendSchema = Boolean(options.jsonSchema);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const provider = options.provider;
      const response = await withTimeout(
        (signal) => provider.generateContent({
          model: options.model,
          prompt: options.prompt,
          systemInstruction: options.systemInstruction,
          images: options.images,
          responseJsonSchema: sendSchema ? options.jsonSchema : undefined,
          thinkingLevel: options.thinkingLevel,
          maxOutputTokens: options.maxOutputTokens ?? 2048,
          abortSignal: signal,
        }),
        options.timeoutMs ?? 13000,
      );

      const text = response.text?.trim();
      if (!text) throw new InvalidModelOutputError('empty_response');

      let json: unknown;
      try {
        json = JSON.parse(extractJsonText(text));
      } catch {
        throw new InvalidModelOutputError('invalid_json');
      }

      const parsed = options.schema.safeParse(json);
      if (!parsed.success) throw new InvalidModelOutputError('schema_mismatch');
      if (options.validate && !options.validate(parsed.data)) throw new InvalidModelOutputError('invalid_ids');

      return { value: parsed.data, usedFallback: false };
    } catch (error) {
      finalFailure = failureKindFrom(error);
      // A 400 while a response schema was attached usually means the schema itself was rejected:
      // retry once with plain JSON mode, zod keeps validating the output.
      if (sendSchema && statusCodeFrom(error) === 400) sendSchema = false;
      const shouldRetry = attempt < retries && finalFailure !== 'authentication' && finalFailure !== 'safety';
      if (shouldRetry) {
        await sleep(options.retryDelayMs ?? 180);
        continue;
      }
      break;
    }
  }

  return { value: options.fallback(), usedFallback: true, failureKind: finalFailure };
}
