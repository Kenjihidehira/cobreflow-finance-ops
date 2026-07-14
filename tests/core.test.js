import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAutomationQueue,
  buildSummary,
  calculateRiskScore,
  enrichReceivables,
  filterReceivables,
  loadData,
  reconcilePayments
} from "../src/core.js";

const data = loadData();

test("calcula risco maior para faturas antigas e com saldo alto", () => {
  const highRisk = data.receivables.find((item) => item.id === "INV-2026-0980");
  const lowRisk = data.receivables.find((item) => item.id === "INV-2026-1062");

  assert.ok(calculateRiskScore(highRisk) > calculateRiskScore(lowRisk));
});

test("resume carteira com saldo vencido, prioridades e conciliação", () => {
  const summary = buildSummary(data);

  assert.equal(summary.overdueCount, 8);
  assert.equal(summary.reconciliation.pending, 1);
  assert.ok(summary.expectedCashIn > summary.overdueBalance);
  assert.ok(summary.highPriorityCount >= 3);
});

test("monta fila de automação priorizada por risco", () => {
  const queue = buildAutomationQueue(data);

  assert.equal(queue[0].customer, "NextGen Tech");
  assert.equal(queue[0].channel, "Tarefa interna");
  assert.ok(queue.every((item) => item.balance > 0));
});

test("concilia pagamento pendente quando cliente e valor batem", () => {
  const reconciled = reconcilePayments(data);
  const greenLifePayment = reconciled.payments.find((item) => item.id === "PAY-9094");

  assert.equal(greenLifePayment.matchedInvoiceId, "INV-2026-0942");
  assert.equal(reconciled.reconciliationActions.length, 1);
});

test("filtra recebíveis por canal, status e busca", () => {
  const enriched = enrichReceivables(data.receivables);
  const result = filterReceivables(enriched, {
    channel: "PIX",
    status: "overdue",
    search: "Design"
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].customer, "Design Hub");
});
