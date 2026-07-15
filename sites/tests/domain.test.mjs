import assert from "node:assert/strict";
import test from "node:test";
import seed from "../data/seed.json" with { type: "json" };
import { applyAction, buildDashboard, cloneSeed, normalizeState } from "../lib/domain.js";

test("dashboard calcula carteira, risco e conciliacao", () => {
  const dashboard = buildDashboard(cloneSeed(seed));
  assert.equal(dashboard.receivables.total, seed.receivables.length);
  assert.ok(dashboard.summary.expectedCashIn > 0);
  assert.ok(dashboard.automations.queue.length > 0);
});

test("filtros combinam status, canal e busca", () => {
  const params = new URLSearchParams({ channel: "PIX", search: "rocket" });
  const dashboard = buildDashboard(cloneSeed(seed), params);
  assert.equal(dashboard.receivables.count, 1);
});

test("conciliacao nao altera o estado original", () => {
  const original = cloneSeed(seed);
  const next = applyAction(original, { action: "reconcile" });
  assert.deepEqual(original, seed);
  assert.ok(next.payments.filter((item) => item.matchedInvoiceId).length >= original.payments.filter((item) => item.matchedInvoiceId).length);
});

test("estado invalido e acao desconhecida sao tratados", () => {
  assert.deepEqual(normalizeState({}, seed), seed);
  assert.throws(() => applyAction(cloneSeed(seed), { action: "wipe" }), /nao suportada/);
});
