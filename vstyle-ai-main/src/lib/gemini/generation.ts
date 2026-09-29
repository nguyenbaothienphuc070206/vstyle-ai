import { z } from 'zod';

export interface GeminiGenerationRequest {
  model: string;
  contents: string;
  config: {
    systemInstruction?: string;
    responseMimeType: 'application/json';
    temperature?: number;
    maxOutputTokens?: number;
    abortSignal?: AbortSignal;
  };
}

export interface GeminiTextProvider {
  generateContent(request: GeminiGenerationRequest): Promise<{ text?: string | null }>;
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
  schema: z.ZodType<T>;
  fallback: () => T;
  validate?: (value: T) => boolean;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  maxOutputTokens?: number;
}

class InvalidModelOutputError extends Error {
  constructor(public failureKind: 'empty_response' | 'invalid_json' | 'schema_mismatch' | 'invalid_ids') {
    super(failureKind);
    this.name = 'InvalidModelOutputError';
  }
}

class GeminiTimeoutError extends Error {
  constructor() {
    super('Gemini request timed out');
    this.name = 'GeminiTimeoutError';
  }
}

function statusCodeFrom(error: unknown): number | undefined {
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

function failureKindFrom(error: unknown): GeminiFailureKind {
  if (error instanceof InvalidModelOutputError) return error.failureKind;
  if (error instanceof GeminiTimeoutError || (error instanceof Error && error.name === 'AbortError')) return 'timeout';
  const status = statusCodeFrom(error);
  if (status === 401 || status === 403) return 'authentication';
  if (status === 429) return 'rate_limit';
  if (error instanceof TypeError) return 'network';
  return 'provider';
}

async function generateWithTimeout(
  provider: GeminiTextProvider,
  request: Omit<GeminiGenerationRequest, 'config'> & { config: Omit<GeminiGenerationRequest['config'], 'abortSignal'> },
  timeoutMs: number,
): Promise<{ text?: string | null }> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      reject(new GeminiTimeoutError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      provider.generateContent({
        ...request,
        config: { ...request.config, abortSignal: controller.signal },
      }),
      timeout,
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await generateWithTimeout(
        options.provider,
        {
          model: options.model,
          contents: options.prompt,
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: options.maxOutputTokens ?? 700,
          },
        },
        options.timeoutMs ?? 12000,
      );

      const text = response.text?.trim();
      if (!text) throw new InvalidModelOutputError('empty_response');

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new InvalidModelOutputError('invalid_json');
      }

      const parsed = options.schema.safeParse(json);
      if (!parsed.success) throw new InvalidModelOutputError('schema_mismatch');
      if (options.validate && !options.validate(parsed.data)) throw new InvalidModelOutputError('invalid_ids');

      return { value: parsed.data, usedFallback: false };
    } catch (error) {
      finalFailure = failureKindFrom(error);
      const shouldRetry = attempt < retries && finalFailure !== 'authentication';
      if (shouldRetry) {
        await sleep(options.retryDelayMs ?? 180);
        continue;
      }
      break;
    }
  }

  return { value: options.fallback(), usedFallback: true, failureKind: finalFailure };
}