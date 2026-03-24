import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
export const GEMINI_MODEL = 'gemini-3-flash-preview';

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

    return JSON.parse(response.text || '[]');
  } catch (e) {
    throw new Error('Não foi possível processar a extração de equipamentos com IA. Tente novamente.');
  }
}
