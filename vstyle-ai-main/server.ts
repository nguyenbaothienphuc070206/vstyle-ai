import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { getApprovedGarments, getCultureRules, getGarments } from './src/lib/dal/index.ts';
import { GeminiGenerationRequest } from './src/lib/gemini/generation.ts';
import { createGeminiRouter } from './src/lib/gemini/routes.ts';
import { GeminiServiceConfig } from './src/lib/gemini/service.ts';

dotenv.config();

const app = express();
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL?.trim() || 'gemini-flash-latest';
let aiClient: GoogleGenAI | undefined;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch {
    aiClient = undefined;
  }
}

const geminiConfig: GeminiServiceConfig = {
  model,
  provider: aiClient ? {
    generateContent: async (request: GeminiGenerationRequest) => {
      const response = await aiClient!.models.generateContent(request);
      return { text: response.text };
    },
  } : undefined,
};

app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    product: 'Vstyle',
    hasGeminiKey: Boolean(apiKey && aiClient),
    garmentsCount: getGarments().length,
    approvedGarmentsCount: getApprovedGarments().length,
    rulesCount: getCultureRules().length,
  });
});

app.use('/api/gemini', createGeminiRouter(geminiConfig));

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vstyle Full-Stack Server running on port ${PORT}`);
  });
}

startServer().catch(() => {
  console.error('Vstyle server failed to start.');
});