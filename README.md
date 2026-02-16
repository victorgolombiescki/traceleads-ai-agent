# 🤖 AI Agent Backend (NestJS)

Backend do AI Agent Microservice - Motor FSM (Finite State Machine) e API REST com NestJS.

## 📋 Descrição

Este é o backend que gerencia toda a lógica de conversação com agentes de IA usando uma arquitetura FSM (Finite State Machine). Ao invés de depender de prompts gigantes e não-confiáveis, o fluxo de controle é 100% previsível em código TypeScript, usando o LLM apenas para tarefas específicas.

**Migrado de Express + tRPC para NestJS mantendo 100% da funcionalidade.**

## ✨ Principais Componentes

### 🎛️ FSM Engine (`server/fsm/`)
- **engine.ts**: Motor da máquina de estados finita
- **orchestrator.ts**: Orquestrador principal que gerencia conversas
- **llm-utils.ts**: Utilitários para extração de dados via LLM
- **handlers/**: State handlers para cada etapa da conversa
  - `basic-handlers.ts`: Handlers de coleta de dados (nome, email, telefone)
  - `business-handlers.ts`: Handlers de perguntas de negócio
  - `calendar-handlers.ts`: Handlers de agendamento

### 📦 Services (`server/services/`)
- **agent-service.ts**: CRUD de agentes e templates
- **conversation-service.ts**: Gerenciamento de conversas
- **lead-service.ts**: Gerenciamento de leads capturados
- **calendar-service.ts**: Sistema de agendamento

### 🎯 NestJS Modules (`src/`)
- **agents/**: Módulo de gerenciamento de agentes
- **conversations/**: Módulo de conversas
- **leads/**: Módulo de leads
- **appointments/**: Módulo de agendamentos
- **auth/**: Autenticação e autorização
- **database/**: Configuração do banco de dados (Drizzle)
- **fsm/**: Wrapper do FSM Engine para NestJS

### 🗄️ Database (`drizzle/`)
- Schema e migrations gerenciados pelo Drizzle ORM
- Suporte a PostgreSQL

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Gerar migrations do banco
npm run db:generate

# Aplicar migrations
npm run db:migrate
```

## 🔧 Desenvolvimento

```bash
# Modo desenvolvimento (hot reload)
npm run start:dev

# Build para produção
npm run build

# Rodar em produção
npm run start:prod

# Rodar testes
npm run test

# Rodar testes em modo watch
npm run test:watch
```

## 📝 Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure as variáveis:

```bash
cp .env.example .env
```

### Variáveis Obrigatórias

```env
# Database (OBRIGATÓRIO)
DATABASE_URL=postgresql://user:password@localhost:5432/ai_agents

# Server
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:7000
```

### Variáveis Opcionais

```env
# OpenAI / LLM (necessário para funcionalidades de IA)
OPENAI_API_KEY=seu_token_aqui

# Manus Authentication
OWNER_OPEN_ID=seu_owner_open_id

# AWS S3 (se usar armazenamento de arquivos)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...

# Forge API (Manus Data API)
BUILT_IN_FORGE_API_URL=https://api.manus.app
BUILT_IN_FORGE_API_KEY=...

# Google Maps (se usar mapas)
GOOGLE_MAPS_API_KEY=...

# Logging
LOG_LEVEL=debug
```

**Nota:** O arquivo `.env` não deve ser commitado no git (já está no `.gitignore`).

## 🧪 Testes

O projeto possui testes unitários e de integração:

```bash
npm run test
```

**Cobertura:**
- ✅ FSM Engine (9 testes)
- ✅ LLM Utilities (8 testes)
- ✅ Agent Service (6 testes)
- ✅ Calendar Service (testes)
- ✅ Auth Flow (1 teste)

## 📊 Arquitetura FSM

A grande vantagem desta arquitetura é a **previsibilidade**:

```typescript
// Fluxo tradicional (não-confiável)
❌ User Message → Prompt Gigante → LLM → Resposta Imprevisível

// Nossa arquitetura (confiável)
✅ User Message → FSM Engine → State Handler → LLM (tarefa específica) → Resposta Controlada
```

### Exemplo de State Handler

```typescript
export class CollectingEmailStateHandler extends BaseStateHandler {
  async process(agent, conversation, userMessage) {
    // LLM usado apenas para EXTRAIR o email
    const email = await extractTextField("email", "o endereço de e-mail", userMessage);

    if (email && isValidEmail(email)) {
      // Lógica de transição é CÓDIGO, não prompt!
      return {
        response: `Perfeito! Recebi seu e-mail: ${email} ✅`,
        newContext: this.transitionTo(conversation.context, "COLLECTING_PHONE", {
          customerEmail: email,
        }),
      };
    }

    // Permanece no mesmo estado
    return {
      response: "Não consegui identificar um e-mail válido. Pode informar novamente?",
      newContext: this.stayInState(conversation.context),
    };
  }
}
```

## 🔌 API REST

O backend expõe uma API REST completa:

### Rotas Principais

#### Agents (`/agents`)
- `GET /agents` - Listar todos os agentes do usuário
- `GET /agents/:id` - Obter detalhes de um agente
- `POST /agents` - Criar novo agente
- `POST /agents/create-default` - Criar agente com template padrão
- `PUT /agents/:id` - Atualizar agente
- `DELETE /agents/:id` - Deletar agente

#### Conversations (`/conversations`)
- `POST /conversations/start` - Iniciar nova conversa (público)
- `POST /conversations/send-message` - Enviar mensagem (público)
- `GET /conversations/:id` - Obter detalhes de uma conversa
- `GET /conversations/agent/:agentId` - Listar conversas de um agente

#### Leads (`/leads`)
- `GET /leads/agent/:agentId` - Listar leads de um agente

#### Appointments (`/appointments`)
- `GET /appointments` - Listar todos os agendamentos do usuário
- `GET /appointments/agent/:agentId` - Listar agendamentos de um agente

#### Auth (`/auth`)
- `GET /auth/me` - Obter usuário atual
- `POST /auth/logout` - Fazer logout

## 📁 Estrutura de Pastas

```
src/
├── agents/              # Módulo de agentes
│   ├── agents.controller.ts
│   ├── agents.service.ts
│   ├── agents.module.ts
│   └── dto/
├── conversations/        # Módulo de conversas
│   ├── conversations.controller.ts
│   ├── conversations.service.ts
│   ├── conversations.module.ts
│   └── dto/
├── leads/                # Módulo de leads
├── appointments/         # Módulo de agendamentos
├── auth/                 # Autenticação
├── database/             # Configuração do banco
├── fsm/                  # FSM Engine wrapper
├── app.module.ts         # Módulo raiz
└── main.ts              # Entry point

server/
├── _core/               # Módulos core do Manus
├── fsm/                 # FSM Engine (mantido original)
├── services/            # Camada de serviços (mantido original)
└── db.ts               # Setup do banco de dados

drizzle/
├── schema.ts           # Schema do banco de dados
└── migrations/        # Migrations

shared/
└── types.ts           # Tipos compartilhados
```

## 🛠️ Adicionar Novo Estado

1. **Criar o handler** em `server/fsm/handlers/`:

```typescript
export class MeuNovoStateHandler extends BaseStateHandler {
  async process(agent, conversation, userMessage) {
    // Sua lógica aqui
    return {
      response: "Resposta ao usuário",
      newContext: this.transitionTo(conversation.context, "PROXIMO_ESTADO"),
    };
  }
}
```

2. **Registrar no orchestrator** (`server/fsm/orchestrator.ts`):

```typescript
this.engine.registerHandlers({
  MEU_NOVO_ESTADO: new MeuNovoStateHandler(),
});
```

3. **Adicionar nos tipos** (`shared/types.ts`)

## 🔄 Migração de tRPC para NestJS

A migração foi feita mantendo **100% da funcionalidade**:

- ✅ Todos os serviços mantidos intactos
- ✅ FSM Engine preservado sem alterações
- ✅ Handlers mantidos como estavam
- ✅ Banco de dados (Drizzle) funcionando
- ✅ Autenticação preservada
- ✅ Testes mantidos

**Mudanças:**
- tRPC routers → NestJS Controllers
- tRPC procedures → REST endpoints
- Express middleware → NestJS Guards
- Estrutura modular NestJS

## 📖 Documentação Adicional

Para mais detalhes sobre a arquitetura e decisões de design, consulte o [README original](../ai-agent-microservice/README.md).

## 📄 Licença

MIT
# traceleads-ai-agent
