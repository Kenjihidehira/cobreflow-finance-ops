const state = {
  status: "all",
  channel: "all",
  search: "",
  sent: 0
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const statusLabels = {
  paid: "Pago",
  partial: "Parcial",
  overdue: "Vencido",
  due_today: "Vence hoje",
  due_soon: "Proximo",
  open: "Aberto"
};

function qs(selector) {
  return document.querySelector(selector);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
  return response.json();
}

function riskClass(item) {
  if (item.riskScore >= 82) return "risk-critical";
  if (item.riskScore >= 65) return "risk-high";
  if (item.riskScore >= 45) return "risk-medium";
  return "risk-low";
}

function renderSummary(summary) {
  qs("#expectedCashIn").textContent = money.format(summary.expectedCashIn);
  qs("#overdueBalance").textContent = money.format(summary.overdueBalance);
  qs("#overdueCount").textContent = `${summary.overdueCount} faturas`;
  qs("#reconciliationAmount").textContent = money.format(summary.reconciliation.matchedAmount);
  qs("#reconciliationCount").textContent = `${summary.reconciliation.matched} baixas, ${summary.reconciliation.pending} pendentes`;
  qs("#priorityCount").textContent = summary.highPriorityCount;
}

function renderReceivables(payload) {
  const body = qs("#receivablesBody");
  qs("#resultCount").textContent = `${payload.count} de ${payload.total} recebiveis`;

  body.innerHTML = payload.receivables.map((item) => {
    const dueText = item.overdueDays > 0 ? `${item.overdueDays} dias vencido` : item.dueDate;
    const status = statusLabels[item.status] || item.status;

    return `
      <tr>
        <td><strong>${item.id}</strong><small>${item.customer}</small></td>
        <td>${item.dueDate}<br><small>${dueText}</small></td>
        <td>${money.format(item.amount)}</td>
        <td>${money.format(item.paid)}</td>
        <td class="${item.balance > 0 ? "money-negative" : ""}">${money.format(item.balance)}</td>
        <td><span class="risk-pill ${riskClass(item)}">${item.riskScore}</span></td>
        <td><span class="status-pill status-${item.status}">${status}</span></td>
        <td>${item.channel}</td>
      </tr>
    `;
  }).join("");
}

function renderAutomation(payload) {
  qs("#queueCount").textContent = payload.queue.length;
  qs("#sentCount").textContent = state.sent;
  qs("#automationQueue").innerHTML = payload.queue.slice(0, 5).map((item) => `
    <article class="queue-item">
      <header>
        <strong>${item.customer}</strong>
        <span class="risk-pill ${riskClass(item)}">${item.riskScore}</span>
      </header>
      <p>${item.action} via ${item.channel}</p>
      <p>${item.invoiceId} - ${money.format(item.balance)} - ${item.reason}</p>
    </article>
  `).join("");
}

async function loadDashboard() {
  const params = new URLSearchParams({
    status: state.status,
    channel: state.channel,
    search: state.search
  });

  const [summary, receivables, automations] = await Promise.all([
    fetchJson("/api/summary"),
    fetchJson(`/api/receivables?${params}`),
    fetchJson("/api/automations")
  ]);

  renderSummary(summary);
  renderReceivables(receivables);
  renderAutomation(automations);
}

async function runAutomation() {
  const result = await fetchJson("/api/reminders/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit: 3 })
  });

  state.sent += result.sent;
  qs("#sentCount").textContent = state.sent;
  qs("#automationLog").textContent = `${result.sent} lembretes simulados foram gerados.`;
}

async function runReconciliation() {
  const result = await fetchJson("/api/reconcile", { method: "POST" });
  qs("#automationLog").textContent = result.actions.length
    ? `${result.actions.length} pagamento pendente conciliado automaticamente.`
    : "Nenhum pagamento pendente com correspondencia exata.";
  renderSummary(result.summary);
}

function bindEvents() {
  qs("#statusFilter").addEventListener("change", (event) => {
    state.status = event.target.value;
    loadDashboard();
  });
  qs("#channelFilter").addEventListener("change", (event) => {
    state.channel = event.target.value;
    loadDashboard();
  });
  qs("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    loadDashboard();
  });
  qs("#refreshBtn").addEventListener("click", loadDashboard);
  qs("#runAutomationBtn").addEventListener("click", runAutomation);
  qs("#reconcileBtn").addEventListener("click", runReconciliation);
}

bindEvents();
loadDashboard().catch((error) => {
  qs("#automationLog").textContent = error.message;
});
