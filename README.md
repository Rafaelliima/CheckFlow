# CheckFlow

Aplicação web para análise e verificação de equipamentos a partir de documentos PDF. Faz upload de um relatório, extrai os equipamentos automaticamente via IA e permite que a equipe acompanhe o status de cada item em tempo real.

---

## Funcionalidades

- **Upload e extração via IA** — envie um PDF e o Gemini identifica e estrutura automaticamente todos os equipamentos encontrados
- **Verificação por item** — marque cada equipamento como `Pendente`, `OK` ou `Divergência`
- **Colaboração em tempo real** — múltiplos usuários veem atualizações instantaneamente via WebSocket (Supabase Realtime)
- **Offline-first** — alterações feitas sem conexão são salvas localmente e sincronizadas automaticamente ao voltar online
- **Exportação em PDF** — gere um relatório completo da análise com um clique
- **PWA** — instalável como app no desktop e mobile

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilo | Tailwind CSS v4 |
| Banco local | Dexie (IndexedDB) |
| Backend / Auth | Supabase (PostgreSQL + RLS + Realtime) |
| IA | Google Gemini (`@google/genai`) |
| PDF (leitura) | pdfjs-dist |
| PDF (geração) | @react-pdf/renderer |
| Testes | Vitest + Testing Library |

---

## Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Chave de API do [Google Gemini](https://aistudio.google.com)

---

## Configuração

**1. Clone o repositório**

```bash
git clone https://github.com/seu-usuario/checkflow.git
cd checkflow
```

**2. Instale as dependências**

```bash
npm install
```

**3. Configure as variáveis de ambiente**

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp .env.example .env.local
```

```env
GEMINI_API_KEY=sua_chave_gemini
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

**4. Configure o banco de dados**

No Supabase, abra o SQL Editor e execute o arquivo `supabase/schema.sql`. Ele cria as tabelas `analyses` e `analysis_items` com as políticas de RLS necessárias.

**5. Rode o projeto**

```bash
npm run dev
```

Acesse em `http://localhost:3000`.

---

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm test` | Roda os testes |
| `npm run lint` | Verificação de tipos TypeScript |

---

## Estrutura do projeto

```
src/
├── components/       # Componentes reutilizáveis (Header, PDF, modais...)
├── hooks/            # useAuth, useRealtimeSync
├── lib/              # db, gemini, pdf, sync, supabase
├── pages/            # Dashboard, AnalysisDetail, Login, Register
├── test/             # Testes unitários e de integração
└── types.ts          # Interfaces globais
supabase/
├── schema.sql        # Schema completo com RLS
└── migrations/       # Migrações incrementais
```

---

## Como funciona o sync offline

O CheckFlow usa uma fila de mutações no IndexedDB. Toda alteração (criar, editar, deletar) é salva localmente primeiro e exibida imediatamente na UI. Em paralelo, a operação é enfileirada e enviada ao Supabase assim que há conexão. Em caso de falha, a operação é retentada até 3 vezes com backoff exponencial antes de ser movida para `failed_operations`, onde pode ser reenviada manualmente pelo usuário.

---

## Deploy

O projeto inclui `vercel.json` configurado para SPA. Basta conectar o repositório na Vercel e definir as variáveis de ambiente `GEMINI_API_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no painel.
