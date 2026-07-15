# Arquitetura da prova comercial

## Visao geral

```mermaid
flowchart LR
  B[Dashboard publico] --> API[/api/state]
  API --> AUTH[Sign in with ChatGPT]
  API --> DOMAIN[Risco, cobranca e conciliacao]
  API --> DB[(D1 por usuario)]
  CI[GitHub Actions] --> BUILD[Testes e build Vinext]
```

A API Node original permanece funcional. O deploy em `sites/` adiciona identidade e estado persistente para demonstrar conciliacao e cobranca sem compartilhar alteracoes entre usuarios.

## Limites e seguranca

- A carteira anonima e somente leitura; conciliacao e lembretes exigem login.
- Somente `reconcile` e `run_reminders` sao aceitas para escrita.
- A conciliacao exige igualdade de cliente e valor antes de vincular um pagamento.
- O proprietario do workspace vem da identidade protegida da plataforma, nunca do JSON recebido.
- Nenhum envio financeiro ou mensagem real e executado pela demonstracao.

## Persistencia

O estado e salvo de forma atomica por usuario em D1. A migration reversivel esta em `sites/db/migrations` e o bootstrap idempotente evita indisponibilidade inicial. Uma implantacao real deve normalizar empresas, faturas, pagamentos, contatos e auditoria.

## Qualidade

A CI executa testes e smoke test da API Node, testes negativos e de invariantes do dominio hospedado e build Vinext. O calculo financeiro permanece puro em `sites/lib/domain.js`.
