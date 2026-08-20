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

// A extração via IA roda em /api/extract-equipment (Vercel Serverless Function).
// A GEMINI_API_KEY fica só no servidor e nunca é enviada ao navegador.
export async function extractEquipmentFromText(
  text: string,
  onRetry?: (attempt: number, total: number) => void
) {
  const response = await fetch('/api/extract-equipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    // Isso acontece quando a rota /api/extract-equipment não chega na
    // function (ex.: um rewrite de SPA no vercel.json capturando /api/* e
    // devolvendo o index.html). Mensagem explícita para não falhar em silêncio.
    console.error('extractEquipmentFromText: resposta não-JSON recebida de /api/extract-equipment', {
      status: response.status,
      contentType,
    });
    throw new Error(
      'A extração por IA não está acessível (rota /api/extract-equipment não respondeu em JSON). Verifique o deploy da function.'
    );
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    console.error('extractEquipmentFromText: erro retornado pela function', errorBody);
    throw new Error(errorBody.error || 'Falha ao extrair equipamentos.');
  }

  const { items } = await response.json();
  return sanitizeExtractedItems(items || []);
}
