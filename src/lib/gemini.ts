import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function extractEquipmentFromText(text: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
  
  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error('Failed to parse Gemini response', e);
    return [];
  }
}
