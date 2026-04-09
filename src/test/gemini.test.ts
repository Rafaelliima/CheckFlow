import { describe, expect, it, vi } from 'vitest';

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent,
    };
  },
  Type: {
    ARRAY: 'ARRAY',
    OBJECT: 'OBJECT',
    STRING: 'STRING',
  },
}));

import {
  __testing__,
  extractEquipmentFromText,
  MAX_RETRIES,
  sanitizeExtractedItems,
} from '../../src/lib/gemini';

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

describe('gemini retry', () => {
  it('isRetryable retorna true para erro com "503"', () => {
    expect(__testing__.isRetryable(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('isRetryable retorna true para erro com "429"', () => {
    expect(__testing__.isRetryable(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('isRetryable retorna false para erro genérico', () => {
    expect(__testing__.isRetryable(new Error('Erro inesperado qualquer'))).toBe(false);
  });

  it('extractEquipmentFromText tenta MAX_RETRIES + 1 vezes quando a API sempre retorna 503', async () => {
    vi.useFakeTimers();
    mockGenerateContent.mockReset();
    mockGenerateContent.mockRejectedValue(new Error('503 unavailable'));

    const assertion = expect(extractEquipmentFromText('texto')).rejects.toThrow('503 unavailable');
    await vi.runAllTimersAsync();
    await assertion;
    expect(mockGenerateContent).toHaveBeenCalledTimes(MAX_RETRIES + 1);
    vi.useRealTimers();
  });

  it('extractEquipmentFromText NÃO faz retry para erro não-retryable', async () => {
    vi.useFakeTimers();
    mockGenerateContent.mockReset();
    mockGenerateContent.mockResolvedValue({ text: '{json inválido' });

    await expect(extractEquipmentFromText('texto')).rejects.toBeInstanceOf(SyntaxError);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('onRetry é chamado com attempt e total corretos a cada retry', async () => {
    vi.useFakeTimers();
    mockGenerateContent.mockReset();
    mockGenerateContent
      .mockRejectedValueOnce(new Error('503 unavailable'))
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce({ text: '[]' });
    const onRetry = vi.fn();

    const promise = extractEquipmentFromText('texto', onRetry);
    await vi.runAllTimersAsync();
    await promise;

    expect(onRetry).toHaveBeenNthCalledWith(1, 1, MAX_RETRIES);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, MAX_RETRIES);
    expect(onRetry).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
