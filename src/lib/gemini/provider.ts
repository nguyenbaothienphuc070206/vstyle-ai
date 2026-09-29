/**
 * Server-only Gemini providers built on the Gemini Interactions API (@google/genai >= 2.x).
 * Never import this file from browser code: it reads the API key from the server environment.
 */
import { GoogleGenAI } from '@google/genai';
import {
  statusCodeFrom,
  type GeminiGenerationRequest,
  type GeminiImageProvider,
  type GeminiImageRequest,
  type GeminiTextProvider,
  type GeneratedImage,
  type InlineImage,
} from './generation.ts';

export const DEFAULT_TEXT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_TEXT_FALLBACK_MODEL = 'gemini-flash-latest';
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const DEFAULT_IMAGE_FALLBACK_MODEL = 'gemini-3.1-flash-lite-image';

export interface GeminiProviderSettings {
  apiKey?: string;
  textModel: string;
  textFallbackModel?: string;
  imageModel: string;
  imageFallbackModel?: string;
  /** 'off' omits thinking config (for models that do not support it). */
  thinkingLevel: 'low' | 'medium' | 'high' | 'off';
}

export function readGeminiSettings(env: NodeJS.ProcessEnv): GeminiProviderSettings {
  const clean = (value: string | undefined) => value?.trim() || undefined;
  const apiKey = clean(env.GEMINI_API_KEY);
  const thinking = clean(env.GEMINI_THINKING_LEVEL)?.toLowerCase();
  return {
    // AI Studio templates ship a placeholder value; treat it as "not configured".
    apiKey: apiKey && apiKey !== 'MY_GEMINI_API_KEY' ? apiKey : undefined,
    textModel: clean(env.GEMINI_MODEL) ?? DEFAULT_TEXT_MODEL,
    textFallbackModel: clean(env.GEMINI_FALLBACK_MODEL) ?? DEFAULT_TEXT_FALLBACK_MODEL,
    imageModel: clean(env.GEMINI_IMAGE_MODEL) ?? DEFAULT_IMAGE_MODEL,
    imageFallbackModel: clean(env.GEMINI_IMAGE_FALLBACK_MODEL) ?? DEFAULT_IMAGE_FALLBACK_MODEL,
    thinkingLevel: thinking === 'off' || thinking === 'medium' || thinking === 'high' ? thinking : 'low',
  };
}

function toInput(prompt: string, images: InlineImage[] = []) {
  if (!images.length) return prompt;
  return [
    { type: 'text' as const, text: prompt },
    ...images.map((image) => ({ type: 'image' as const, mime_type: image.mimeType, data: image.data })),
  ];
}

/** 400/404 on the primary model usually means "model not available for this key": try the fallback once. */
function shouldTryFallbackModel(error: unknown): boolean {
  const status = statusCodeFrom(error);
  return status === 404 || status === 400;
}

async function withModelFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  const uniqueModels = [...new Set(models.filter(Boolean))];
  for (const [index, model] of uniqueModels.entries()) {
    try {
      return await run(model);
    } catch (error) {
      lastError = error;
      if (index === uniqueModels.length - 1 || !shouldTryFallbackModel(error)) throw error;
    }
  }
  throw lastError;
}

export interface GeminiProviders {
  text?: GeminiTextProvider;
  image?: GeminiImageProvider;
  settings: GeminiProviderSettings;
}

export function createGeminiProviders(settings: GeminiProviderSettings): GeminiProviders {
  if (!settings.apiKey) return { settings };

  let client: GoogleGenAI;
  try {
    client = new GoogleGenAI({ apiKey: settings.apiKey });
  } catch {
    return { settings };
  }

  const text: GeminiTextProvider = {
    async generateContent(request: GeminiGenerationRequest) {
      const models = request.model === settings.textModel
        ? [settings.textModel, settings.textFallbackModel ?? '']
        : [request.model];
      return withModelFallback(models, async (model) => {
        const interaction = await client.interactions.create({
          model,
          input: toInput(request.prompt, request.images),
          system_instruction: request.systemInstruction,
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            ...(request.responseJsonSchema ? { schema: request.responseJsonSchema } : {}),
          },
          generation_config: {
            max_output_tokens: request.maxOutputTokens,
            ...(settings.thinkingLevel === 'off' ? {} : { thinking_level: request.thinkingLevel ?? settings.thinkingLevel }),
          },
          // Vstyle never needs server-side conversation state; do not retain user prompts or photos.
          store: false,
        }, { signal: request.abortSignal, maxRetries: 0 });
        return { text: interaction.output_text ?? null };
      });
    },
  };

  const image: GeminiImageProvider = {
    async generateImage(request: GeminiImageRequest): Promise<GeneratedImage | null> {
      const models = request.model === settings.imageModel
        ? [settings.imageModel, settings.imageFallbackModel ?? '']
        : [request.model];
      return withModelFallback(models, async (model) => {
        const interaction = await client.interactions.create({
          model,
          input: toInput(request.prompt, request.images),
          response_format: {
            type: 'image',
            mime_type: 'image/jpeg',
            aspect_ratio: request.aspectRatio ?? '3:4',
            image_size: '1K',
          },
          store: false,
        }, { signal: request.abortSignal, maxRetries: 0 });
        const output = interaction.output_image;
        if (!output?.data) return null;
        return { data: output.data, mimeType: output.mime_type ?? 'image/jpeg' };
      });
    },
  };

  return { text, image, settings };
}
