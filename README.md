<div align="center">

<img src="public/icons/pwa-512.svg" alt="CheckFlow Logo" width="80" />

# CheckFlow

**Análise e verificação de equipamentos com extração inteligente via IA**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?style=flat-square&logo=google&logoColor=white)](https://aistudio.google.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)

</div>

---

## O que é

CheckFlow é uma PWA para equipes que precisam verificar equipamentos físicos a partir de documentos PDF. Faça upload do relatório, a IA extrai todos os itens automaticamente, e a equipe marca cada um como **OK**, **Pendente** ou **Divergência** — tudo em tempo real e com suporte offline.

---

## ✨ Funcionalidades

| | |
|---|---|
| 📄 **Extração via IA** | Envie um PDF e o Gemini identifica e estrutura todos os equipamentos encontrados |
| ✅ **Verificação por item** | Marque cada equipamento como `Pendente`, `OK` ou `Divergência` |
| 🔄 **Tempo real** | Múltiplos usuários veem atualizações instantâneas via WebSocket |
| 📶 **Offline-first** | Alterações salvas localmente e sincronizadas ao voltar online |
| 📊 **Exportar PDF** | Gere um relatório completo da análise com um clique |
| 📱 **PWA** | Instalável como app no desktop e mobile |

---

## 🛠️ Stack

<table>
  <tr>
    <td><b>Frontend</b></td>
    <td>React 19 + TypeScript + Vite</td>
  </tr>
  <tr>
    <td><b>Estilo</b></td>
    <td>Tailwind CSS v4</td>
  </tr>
  <tr>
    <td><b>Banco local</b></td>
    <td>Dexie (IndexedDB)</td>
  </tr>
  <tr>
    <td><b>Backend / Auth</b></td>
    <td>Supabase — PostgreSQL + RLS + Realtime</td>
  </tr>
  <tr>
    <td><b>IA</b></td>
    <td>Google Gemini via <code>@google/genai</code></td>
  </tr>
  <tr>
    <td><b>PDF (leitura)</b></td>
    <td>pdfjs-dist</td>
  </tr>
  <tr>
    <td><b>PDF (geração)</b></td>
    <td>@react-pdf/renderer</td>
  </tr>
  <tr>
    <td><b>Testes</b></td>
    <td>Vitest + Testing Library</td>
  </tr>
</table>

---

## 🚀 Configuração local

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Chave de API do [Google Gemini](https://aistudio.google.com)

### Passo a passo

**1. Clone e instale**

```bash
git clone https://github.com/seu-usuario/checkflow.git
cd checkflow
npm install
```

**2. Variáveis de ambiente**

```bash
cp .env.example .env.local
```

```env
GEMINI_API_KEY=sua_chave_gemini
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

**3. Banco de dados**

No Supabase, abra o **SQL Editor** e execute o arquivo `supabase/schema.sql`.

**4. Rode**

```bash
npm run dev
# http://localhost:3000
```

---

## 📁 Estrutura

```
src/
├── components/     # Header, modais, AnalysisPDF, indicadores
├── hooks/          # useAuth, useRealtimeSync
├── lib/            # db, gemini, pdf, sync, supabase
├── pages/          # Dashboard, AnalysisDetail, Login, Register
├── test/           # Testes unitários e de integração
└── types.ts        # Interfaces globais

supabase/
├── schema.sql      # Schema completo com RLS
└── migrations/     # Migrações incrementais
```

---

## 📜 Scripts

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run preview      # Preview do build
npm test             # Roda os testes
npm run lint         # Verificação de tipos TypeScript
```

---

<details>
<summary><b>⚙️ Como funciona o sync offline</b></summary>

<br>

Toda alteração (criar, editar, deletar) é salva localmente no IndexedDB **primeiro** e exibida imediatamente na UI — sem esperar o servidor.

Em paralelo, a operação entra numa fila de sync e é enviada ao Supabase assim que há conexão. Em caso de falha, é retentada até **3 vezes** com backoff exponencial (500ms → 1s → 2s). Se esgotar as tentativas, vai para `failed_operations`, onde o usuário pode reenviar manualmente.

</details>

<details>
<summary><b>🔒 Modelo de permissões (RLS)</b></summary>

<br>

| Ação | Regra |
|---|---|
| **Ler** análises e itens | Qualquer usuário autenticado |
| **Criar / Editar / Deletar** | Apenas o dono (`user_id`) |

Isso permite colaboração em leitura e tempo real, mantendo controle de escrita por usuário.

</details>

---

## ☁️ Deploy

O projeto inclui `vercel.json` configurado para SPA. Conecte o repositório na Vercel e defina as variáveis de ambiente no painel:

- `GEMINI_API_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
