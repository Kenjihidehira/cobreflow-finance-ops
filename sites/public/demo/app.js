const filters = { status: "all", channel: "all", search: "", sort: "risk" };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels = { paid: "Pago", partial: "Parcial", overdue: "Vencido", due_today: "Vence hoje", due_soon: "Proximo", open: "Aberto" };
const channelLabels = { Cartao: "Cartao" };
let session = { canWrite: false };

function qs(selector) {
  return document.querySelector(selector);
}

async function requestState(path = "", options) {
  const response = await fetch(`/api/state${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    if (payload.signInUrl) window.location.href = payload.signInUrl;
    throw new Error(payload.error || `Falha HTTP ${response.status}`);
  }
  return payload;
}

function riskClass(item) {
  if (item.riskScore >= 82) return "risk-critical";
  if (item.riskScore >= 65) return "risk-high";
  if (item.riskScore >= 45) return "risk-medium";
  return "risk-low";
}

function render(payload) {
  const { summary, receivables, automations } = payload;
  qs("#expectedCashIn").textContent = money.format(summary.expectedCashIn);
  qs("#overdueBalance").textContent = money.format(summary.overdueBalance);
  qs("#overdueCount").textContent = `${summary.overdueCount} faturas`;
  qs("#reconciliationAmount").textContent = money.format(summary.reconciliation.matchedAmount);
  qs("#reconciliationCount").textContent = `${summary.reconciliation.matched} baixas, ${summary.reconciliation.pending} pendentes`;
  qs("#priorityCount").textContent = summary.highPriorityCount;
  qs("#resultCount").textContent = `${receivables.count} de ${receivables.total} recebiveis`;
  const orderedReceivables = [...receivables.receivables].sort((left, right) => {
    if (filters.sort === "balance") return right.balance - left.balance;
    if (filters.sort === "due") return new Date(left.dueDate) - new Date(right.dueDate);
    if (filters.sort === "customer") return left.customer.localeCompare(right.customer, "pt-BR");
    return right.riskScore - left.riskScore;
  });
  const tableBody = qs("#receivablesBody");
  tableBody.setAttribute("aria-busy", "false");
  tableBody.innerHTML = orderedReceivables.length ? orderedReceivables.map((item) => {
    const dueText = item.overdueDays > 0 ? `${item.overdueDays} dias vencido` : item.dueDate;
    return `<tr><td><strong>${item.id}</strong><small>${item.customer}</small></td><td>${item.dueDate}<br><small>${dueText}</small></td><td>${money.format(item.amount)}</td><td>${money.format(item.paid)}</td><td class="${item.balance > 0 ? "money-negative" : ""}">${money.format(item.balance)}</td><td><span class="risk-pill ${riskClass(item)}">${item.riskScore}</span></td><td><span class="status-pill status-${item.status}">${statusLabels[item.status] || item.status}</span></td><td>${channelLabels[item.channel] || item.channel}</td></tr>`;
  }).join("") : '<tr><td class="empty-state" colspan="8"><strong>Nenhum recebivel encontrado</strong><span>Ajuste ou limpe os filtros da carteira.</span></td></tr>';
  qs("#queueCount").textContent = automations.queue.length;
  qs("#sentCount").textContent = automations.sent;
  qs("#automationQueue").innerHTML = automations.queue.length ? automations.queue.slice(0, 5).map((item) => `<article class="queue-item"><header><strong>${item.customer}</strong><span class="risk-pill ${riskClass(item)}">${item.riskScore}</span></header><p>${item.action} via ${channelLabels[item.channel] || item.channel}</p><p>${item.invoiceId} - ${money.format(item.balance)} - ${item.reason}</p></article>`).join("") : '<div class="empty-state"><strong>Fila de cobrança vazia</strong><span>Nao ha recebiveis elegiveis para contato.</span></div>';
  renderSession(payload.session);
}

function renderSession(next) {
  session = next;
  let element = qs("#auth-session");
  if (!element) {
    element = document.createElement("a");
    element.id = "auth-session";
    element.className = "auth-session";
    (qs(".header-actions, .topbar-actions, header") || document.body).append(element);
  }
  element.textContent = session.authenticated ? `Sessao: ${session.displayName} | Sair` : "Modo demo | Entrar para salvar";
  element.href = session.authenticated ? session.signOutUrl : session.signInUrl;
}

async function loadDashboard() {
  const params = new URLSearchParams(filters);
  setBusy(true);
  try {
    render(await requestState(`?${params}`));
  } finally {
    setBusy(false);
  }
}

async function action(name) {
  if (!session.canWrite) {
    window.location.href = session.signInUrl;
    return;
  }
  setBusy(true);
  try {
    const result = await requestState("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: name }) });
    render(result);
    qs("#automationLog").textContent = name === "run_reminders"
      ? `${result.automations.sent} lembretes registrados com auditoria.`
      : `${result.reconciliationActions.length} pagamentos conciliados e persistidos.`;
  } finally {
    setBusy(false);
  }
}

function setBusy(isBusy) {
  qs("#receivablesBody").setAttribute("aria-busy", String(isBusy));
  for (const button of document.querySelectorAll("#refreshBtn, #runAutomationBtn, #reconcileBtn")) button.disabled = isBusy;
}

function debounce(callback, delay = 220) {
  let timeout;
  return (...args) => { window.clearTimeout(timeout); timeout = window.setTimeout(() => callback(...args), delay); };
}

qs("#statusFilter").addEventListener("change", (event) => { filters.status = event.target.value; loadDashboard().catch(showError); });
qs("#channelFilter").addEventListener("change", (event) => { filters.channel = event.target.value; loadDashboard().catch(showError); });
qs("#searchInput").addEventListener("input", debounce((event) => { filters.search = event.target.value; loadDashboard().catch(showError); }));
qs("#sortFilter").addEventListener("change", (event) => { filters.sort = event.target.value; loadDashboard().catch(showError); });
qs("#clearFilters").addEventListener("click", () => {
  Object.assign(filters, { status: "all", channel: "all", search: "", sort: "risk" });
  qs("#statusFilter").value = "all";
  qs("#channelFilter").value = "all";
  qs("#searchInput").value = "";
  qs("#sortFilter").value = "risk";
  loadDashboard().catch(showError);
});
qs("#refreshBtn").addEventListener("click", () => loadDashboard().catch(showError));
qs("#runAutomationBtn").addEventListener("click", () => action("run_reminders").catch(showError));
qs("#reconcileBtn").addEventListener("click", () => action("reconcile").catch(showError));

function showError(error) {
  setBusy(false);
  qs("#automationLog").textContent = `Falha ao carregar: ${error.message}`;
}

document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach((navItem) => navItem.classList.remove("active"));
  item.classList.add("active");
}));
loadDashboard().catch(showError);
