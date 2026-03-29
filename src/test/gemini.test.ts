import { describe, expect, it, vi } from 'vitest';

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: vi.fn(),
    };
  },
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
}));

import { sanitizeExtractedItems } from '../../src/lib/gemini';

describe('gemini sanitizer', () => {
  it('decodifica entidades HTML em todos os campos textuais dos itens extraídos', () => {
    const result = sanitizeExtractedItems([
      {
        tag: 'INFUS&Atilde;O',
        descricao: 'OTOSC&Oacute;PIO',
        modelo: 'TERMOHIGR&Ocirc;METRO',
        patrimonio: 'PATRIM&Ocirc;NIO-01',
        numero_serie: 'S&Eacute;RIE-02',
        status: 'Pendente',
      },
    ]);

    expect(result[0]).toMatchObject({
      tag: 'INFUSÃO',
      descricao: 'OTOSCÓPIO',
      modelo: 'TERMOHIGRÔMETRO',
      patrimonio: 'PATRIMÔNIO-01',
      numero_serie: 'SÉRIE-02',
      status: 'Pendente',
    });
  });
});
