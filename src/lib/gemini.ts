import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const GEMINI_MODEL = 'gemini-3-flash-preview';

export function decodeHtmlEntities(text: string): string {
  if (typeof DOMParser === 'undefined') return text;
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.documentElement.textContent ?? text;
}

export function sanitizeExtractedItems(items: any[]) {
  return items.map((item) => ({
    ...item,
    tag: typeof item.tag === 'string' ? decodeHtmlEntities(item.tag) : item.tag,
    descricao: typeof item.descricao === 'string' ? decodeHtmlEntities(item.descricao) : item.descricao,
    modelo: typeof item.modelo === 'string' ? decodeHtmlEntities(item.modelo) : item.modelo,
    patrimonio: typeof item.patrimonio === 'string' ? decodeHtmlEntities(item.patrimonio) : item.patrimonio,
    numero_serie: typeof item.numero_serie === 'string' ? decodeHtmlEntities(item.numero_serie) : item.numero_serie,
  }));
}

export async function extractEquipmentFromText(text: string) {
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
              status: { type: Type.STRING, description: 'Sempre "Pendente"' }
            },
            required: ['tag', 'descricao', 'modelo', 'patrimonio', 'numero_serie', 'status']
          }
        }
      }
    });

    const parsed = JSON.parse(response.text || '[]');
    return sanitizeExtractedItems(parsed);
  } catch (e) {
    throw new Error('Não foi possível processar a extração de equipamentos com IA. Tente novamente.');
  }
}
