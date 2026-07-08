# CobreFlow Finance Ops

Dashboard financeiro full-stack para pequenas empresas acompanharem recebiveis, conciliacao de pagamentos e cobranca ativa em um unico fluxo operacional.

O projeto foi pensado como peca de portfolio para propostas freelance: ele resolve uma dor comercial clara, mostra tela, API, regras de negocio, dados de exemplo, automacoes simuladas e testes nativos.

## Valor comercial

Pequenas empresas perdem caixa por atraso de pagamento, baixa manual de PIX/boleto e falta de prioridade na cobranca. O CobreFlow centraliza:

- carteira de recebiveis com status e saldo em aberto;
- score de risco por atraso, valor e historico de contato;
- fila de cobranca automatizada por email, WhatsApp ou tarefa interna;
- conciliacao simulada de pagamentos pendentes;
- dashboard de KPIs para decisao rapida de caixa.

Esse tipo de sistema pode ser vendido para prestadores de servico, agencias, clinicas, assistencias tecnicas, pequenas distribuidoras e times financeiros que ainda controlam cobrancas em planilhas.

## Preview

![Preview do dashboard](docs/dashboard-preview.svg)

## Funcionalidades

- Dashboard responsivo com KPIs de entrada prevista, vencidos, conciliacao e acoes prioritarias.
- Tabela de recebiveis com busca, filtro por status, filtro por canal e risco financeiro.
- API REST sem dependencias externas, usando Node.js nativo.
- Score de risco calculado por saldo, dias vencidos, contato recente e promessa de pagamento.
- Simulacao de envio de lembretes por automacao.
- Simulacao de conciliacao de pagamentos pendentes.
- Dados seed comerciais com clientes, faturas, canais e regras de automacao.
- Testes unitarios e testes de API com `node:test`.
- Dockerfile pronto para deploy em plataformas que executam containers.

## Stack

- Node.js nativo
- HTML, CSS e JavaScript puro
- `node:test`
- Dados JSON seed
- Docker

## Como rodar localmente

Requisito: Node.js 20 ou superior.

```bash
npm start
```

Acesse:

```text
http://localhost:3000
```

## Validacao

```bash
npm test
npm run smoke
```

Ou tudo junto:

```bash
npm run validate
```

## Endpoints

### `GET /api/health`

Retorna status do servico.

### `GET /api/summary`

Retorna KPIs financeiros:

- entrada prevista;
- saldo vencido;
- quantidade de faturas vencidas;
- prioridades;
- conciliacao de pagamentos.

### `GET /api/receivables`

Lista recebiveis enriquecidos com saldo, status, dias vencidos, score e prioridade.

Parametros opcionais:

- `status=all|overdue|partial|due_today|critical|high`
- `channel=all|PIX|Boleto|Cartao`
- `search=texto`

Exemplo:

```text
/api/receivables?status=overdue&channel=PIX&search=green
```

### `GET /api/automations`

Retorna regras de automacao e fila priorizada de cobranca.

### `POST /api/reminders/run`

Simula envio de lembretes.

Body:

```json
{
  "limit": 3
}
```

### `POST /api/reconcile`

Simula conciliacao automatica de pagamentos pendentes quando cliente e valor batem com uma fatura aberta.

## Deploy

### Docker

```bash
docker build -t cobreflow-finance-ops .
docker run -p 3000:3000 cobreflow-finance-ops
```

### Render, Railway, Fly.io ou similar

- Build command: nao necessario se usar Dockerfile.
- Start command: `node src/server.js`
- Porta: usar variavel `PORT` fornecida pela plataforma.

Deploy real nao esta incluido por padrao porque depende de credencial e conta configurada na plataforma escolhida.

## Possiveis melhorias comerciais

- Integracao real com gateway PIX/boleto.
- Login multiempresa e permissoes por perfil.
- Webhooks de pagamento.
- Envio real por WhatsApp Business Cloud ou email transacional.
- Historico completo de contatos por cliente.
- Exportacao CSV/PDF para financeiro.
- Persistencia em Postgres.
- Painel de templates de cobranca editaveis.

## Diferenciais para portfolio

- Foca em um problema comercial claro, nao em CRUD generico.
- Demonstra regras de negocio e priorizacao financeira.
- Mostra API, dashboard e automacao no mesmo projeto.
- Inclui seed realista, testes e Dockerfile.
- Pode ser explicado em propostas como base de MVP para cobranca e contas a receber.
