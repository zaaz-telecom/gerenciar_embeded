# CLAUDE.md — MIS (Gestão Integrada B2B)

> Regras e contexto do projeto para o Claude Code.

---

## CONTEXTO DO PROJETO

**Produto:** Plataforma B2B de Gestão Integrada (MIS - Management Information System)
**Domínio:** `mis.online.net.br`
**Empresa:** TatuTec

### Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Astro 6 (SSR + Hybrid) |
| UI | React 19 + Tailwind CSS 4 |
| Banco de Dados | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Email | Resend |
| Deploy | Vercel |
| Funções Edge | Supabase Edge Functions (Deno) |
| BI | Power BI Embed (Service Principal / App owns data) |
| Sync HR | Voors API |

### Estrutura Principal

```
src/
├── pages/api/      # Endpoints server-side (Astro API Routes)
├── components/     # Componentes React reutilizáveis
├── modules/        # Módulos de feature (admin, users, processes, indicators)
├── lib/            # Utilitários compartilhados (supabase.ts, resend.ts)
└── types/          # TypeScript types globais
supabase/
├── migrations/     # SQL migrations
└── functions/      # Edge Functions Deno
.agent/             # Base de conhecimento de agentes (legado Antigravity Kit)
```

### Multi-tenancy

Todas as tabelas críticas usam `organization_id` + Row Level Security (RLS) no Supabase.
**Nunca remova `organization_id` de queries ou esqueça de aplicar RLS.**

---

## REGRAS GLOBAIS (SEMPRE ATIVAS)

### Idioma

- Responda **sempre em português** (o usuário é brasileiro)
- Código, variáveis, comentários e commits: **sempre em inglês**

### Qualidade de Código

- Código limpo, direto, sem over-engineering
- TypeScript strict — sem `any` sem justificativa
- Sem comentários óbvios; comente apenas o "porquê" não-óbvio
- Sem features fora do escopo pedido
- Sem `console.log` em produção

### Segurança (Obrigatório)

- **Nunca exponha** `SUPABASE_SERVICE_ROLE_KEY`, `PBI_CLIENT_SECRET`, `RESEND_API_KEY` no client
- Secrets ficam apenas em variáveis de ambiente server-side
- Valide inputs nas fronteiras do sistema (API routes, Edge Functions)
- Sanitize HTML com `sanitize-html` quando necessário
- Power BI tokens gerados **apenas server-side** via SSR

### Dependências de Arquivo

Antes de modificar qualquer arquivo:
1. Identifique arquivos dependentes (imports, re-exports)
2. Atualize todos os afetados em conjunto
3. Verifique se types globais em `src/types/` precisam de atualização

---

## ROTEAMENTO DE ESPECIALISTAS

O projeto tem uma base de conhecimento em `.agent/agents/` e `.agent/skills/`. Use-a como referência quando relevante:

| Domínio | Agente de referência | Skills relevantes |
|---------|---------------------|-------------------|
| UI/UX / React | `.agent/agents/frontend-specialist.md` | `react-best-practices`, `tailwind-patterns`, `frontend-design` |
| API / Lógica de negócio | `.agent/agents/backend-specialist.md` | `api-patterns`, `nodejs-best-practices` |
| Schema / SQL | `.agent/agents/database-architect.md` | `database-design` |
| Debug | `.agent/agents/debugger.md` | `systematic-debugging` |
| Segurança | `.agent/agents/security-auditor.md` | `vulnerability-scanner` |
| Testes | `.agent/agents/test-engineer.md` | `testing-patterns`, `webapp-testing` |
| Performance | `.agent/agents/performance-optimizer.md` | `performance-profiling` |

---

## PADRÕES DO PROJETO

### API Routes (Astro)

```typescript
// src/pages/api/exemplo.ts
import type { APIRoute } from 'astro'
import { createClient } from '@/lib/supabase'

export const POST: APIRoute = async ({ request }) => {
  const supabase = createClient(request)
  // Sempre verificar auth antes de qualquer operação
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  // ...
}
```

### Supabase Client

- `src/lib/supabase.ts` — client para uso nos componentes e server
- Service Role Key: **apenas em Edge Functions ou API routes server-side**
- Sempre usar RLS; nunca bypasse com service role desnecessariamente

### Componentes React

- Functional components com TypeScript
- Props tipadas com `interface`
- `lucide-react` para ícones
- `recharts` para gráficos
- `reactflow` para diagramas de processos

### Emails (Resend)

- Templates gerenciados via `email_templates` no Supabase (por organização)
- Variáveis interpoladas: `{{nome}}`, `{{empresa}}` etc.
- Envio via `/api/emails/send` ou `/api/emails/bulk-send`

### Power BI Embed

- Estratégia: **App owns data** (Service Principal)
- Token gerado server-side em `/api/pbi/token.ts`
- Credenciais por organização em `organization_settings`

---

## MÓDULOS DO SISTEMA

| Módulo | Status | Descrição |
|--------|--------|-----------|
| Auth | ✅ Completo | Login, registro, sessão via Supabase |
| Usuários | ✅ Completo | CRUD, roles (admin/manager/user), convites |
| Organizações | ✅ Completo | Multi-tenant, settings por org |
| Processos | ✅ Completo | Criação, versionamento, aprovação de processos |
| Indicadores | ✅ Completo | KPIs, metas vs realizado |
| Dashboards | ✅ Completo | Power BI embed por organização |
| Email Campaigns | ✅ Completo | Templates, envio bulk, logs |
| Sync Voors | ✅ Completo | Sincronização de dados de colaboradores |
| Suporte | ✅ Completo | Widget de feedback com notificação por email |

---

## SCRIPTS DE VALIDAÇÃO

A base Antigravity tem scripts Python em `.agent/scripts/`. Use quando pedido:

```bash
# Auditoria rápida de qualidade
python .agent/scripts/checklist.py .

# Verificação completa pré-deploy
python .agent/scripts/verify_all.py . --url http://localhost:4321
```

---

## FLUXO PARA TAREFAS COMPLEXAS

Para implementações grandes (nova feature, refactor estrutural):

1. **Entender** — Ler arquivos relevantes antes de codar
2. **Perguntar** — Se houver ambiguidade, perguntar antes de implementar
3. **Planejar** — Para mudanças multi-arquivo, propor o plano primeiro
4. **Implementar** — Executar após alinhamento
5. **Verificar** — Checar tipos, lint, e fluxos afetados

---

## VARIÁVEIS DE AMBIENTE

```bash
# Supabase
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # SERVER-SIDE ONLY

# Power BI (Service Principal)
PBI_TENANT_ID=
PBI_CLIENT_ID=
PBI_CLIENT_SECRET=            # SERVER-SIDE ONLY

# Resend
RESEND_API_KEY=               # SERVER-SIDE ONLY
RESEND_FROM_NAME=
RESEND_FROM_EMAIL=

# Cloudflare Turnstile
PUBLIC_TURNSTILE_SITE_KEY=
SECRET_KEY=                   # SERVER-SIDE ONLY

# App
PUBLIC_SITE_URL=
```
