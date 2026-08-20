// Vercel Serverless Function.
// Runs only on the server: GEMINI_API_KEY never reaches the browser bundle.
// Configure GEMINI_API_KEY as a (non-VITE_) environment variable on Vercel.
import { GoogleGenAI, Type } from '@google/genai';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function isRetryable(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes('503') ||
    message.includes('429') ||
    message.includes('unavailable') ||
    message.includes('rate limit')
  );
}

// Minimal request/response typing so this compiles without adding @vercel/node
// as a dependency. Vercel's Node runtime passes objects compatible with these.
interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as { text?: unknown };
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'Campo "text" é obrigatório.' });
    return;
  }

  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    return;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `Extraia os equipamentos do seguinte texto. Se alguma informação estiver ausente, use "N/A". O status deve ser sempre "Pendente".\n\nTexto:\n${text}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tag: { type: Type.STRING },
                descricao: { type: Type.STRING },
                modelo: { type: Type.STRING },
                patrimonio: { type: Type.STRING },
                numero_serie: { type: Type.STRING },
                status: { type: Type.STRING, description: 'Sempre "Pendente"' },
              },
              required: ['tag', 'descricao', 'modelo', 'patrimonio', 'numero_serie', 'status'],
            },
          },
        },
      });

      const parsed = JSON.parse(response.text || '[]');
      res.status(200).json({ items: parsed });
      return;
    } catch (error) {
      const shouldRetry = attempt < MAX_RETRIES && isRetryable(error);
      if (!shouldRetry) {
        console.error('extract-equipment: falha ao chamar Gemini', error);
        res.status(502).json({ error: 'Falha ao extrair equipamentos a partir do texto.' });
        return;
      }
      const delay = BASE_DELAY_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
