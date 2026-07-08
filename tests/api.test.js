import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../src/server.js";

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

async function withServer(callback) {
  const server = createServer();
  const port = await listen(server);
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("GET /api/summary retorna KPIs financeiros", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/summary`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(payload.expectedCashIn > 0);
    assert.equal(payload.reconciliation.pending, 1);
  });
});

test("GET /api/receivables aplica filtros", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/receivables?status=overdue&channel=PIX&search=green`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.count, 1);
    assert.equal(payload.receivables[0].customer, "Green Life");
  });
});

test("POST /api/reminders/run simula envio de cobrancas", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/reminders/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2 })
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.sent, 2);
    assert.ok(payload.items[0].message.includes("NextGen Tech"));
  });
});
