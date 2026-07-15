const day = 86_400_000;
const today = "2026-07-08";

export function cloneSeed(seed) {
  return structuredClone(seed);
}

export function normalizeState(value, fallback) {
  return structuredClone(
    value && Array.isArray(value.receivables) && Array.isArray(value.payments) && Array.isArray(value.automationRules)
      ? value
      : fallback,
  );
}

function daysBetween(date) {
  return Math.floor((new Date(`${today}T12:00:00-03:00`) - new Date(`${date}T12:00:00-03:00`)) / day);
}

function balance(receivable) {
  return Math.max(0, Number(receivable.amount) - Number(receivable.paid || 0));
}

function status(receivable) {
  const open = balance(receivable);
  const overdueDays = daysBetween(receivable.dueDate);
  if (open <= 0) return "paid";
  if (receivable.paid > 0) return "partial";
  if (overdueDays > 0) return "overdue";
  if (overdueDays === 0) return "due_today";
  if (overdueDays >= -2) return "due_soon";
  return "open";
}

function enrich(receivables) {
  return receivables.map((item) => {
    const open = balance(item);
    const overdueDays = Math.max(0, daysBetween(item.dueDate));
    const contactGap = item.lastContactAt ? Math.max(0, daysBetween(item.lastContactAt)) : 18;
    const score = Math.max(0, Math.min(99, Math.round(
      18 + overdueDays * 1.6 + Math.min(22, Math.floor(open / 700)) + Math.min(18, contactGap)
      + (item.paid > 0 && open > 0 ? -8 : 0)
      + (item.promiseDate && daysBetween(item.promiseDate) <= 0 ? -12 : 0),
    )));
    return {
      ...item,
      balance: open,
      status: status(item),
      overdueDays,
      riskScore: score,
      priority: score >= 82 ? "critical" : score >= 65 ? "high" : score >= 45 ? "medium" : "low",
    };
  }).sort((a, b) => b.riskScore - a.riskScore || b.balance - a.balance);
}

function summary(state, receivables) {
  const open = receivables.filter((item) => item.balance > 0);
  const overdue = receivables.filter((item) => ["overdue", "partial"].includes(item.status));
  const matched = state.payments.filter((payment) => payment.matchedInvoiceId);
  const pending = state.payments.filter((payment) => !payment.matchedInvoiceId);
  return {
    expectedCashIn: open.reduce((sum, item) => sum + item.balance, 0),
    overdueBalance: overdue.reduce((sum, item) => sum + item.balance, 0),
    overdueCount: overdue.length,
    highPriorityCount: receivables.filter((item) => ["critical", "high"].includes(item.priority)).length,
    reconciliation: {
      matched: matched.length,
      pending: pending.length,
      matchedAmount: matched.reduce((sum, item) => sum + item.amount, 0),
      pendingAmount: pending.reduce((sum, item) => sum + item.amount, 0),
    },
  };
}

function automations(state, receivables) {
  return receivables.filter((item) => item.balance > 0).slice(0, 8).map((item) => {
    const ruleId = item.riskScore >= 82 || item.overdueDays > 30
      ? "rule-human-escalation"
      : item.overdueDays > 0 ? "rule-whatsapp-overdue" : "rule-soft-reminder";
    const rule = state.automationRules.find((candidate) => candidate.id === ruleId);
    return {
      invoiceId: item.id,
      customer: item.customer,
      balance: item.balance,
      riskScore: item.riskScore,
      priority: item.priority,
      action: rule.name,
      channel: rule.channel,
      reason: item.overdueDays > 0 ? `${item.overdueDays} dias vencido` : "vencimento proximo",
    };
  });
}

export function buildDashboard(state, params = new URLSearchParams()) {
  const all = enrich(state.receivables);
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const statusFilter = params.get("status") ?? "all";
  const channel = params.get("channel") ?? "all";
  const filtered = all.filter((item) =>
    (statusFilter === "all" || item.status === statusFilter || item.priority === statusFilter)
    && (channel === "all" || item.channel.toLowerCase() === channel.toLowerCase())
    && (!search || `${item.id} ${item.customer} ${item.customerEmail}`.toLowerCase().includes(search)),
  );
  return {
    summary: summary(state, all),
    receivables: { count: filtered.length, total: all.length, receivables: filtered },
    automations: { queue: automations(state, all), sent: state.reminderAudit?.sent ?? 0 },
    reconciliationActions: state.reconciliationActions ?? [],
  };
}

export function applyAction(state, input) {
  if (input.action === "run_reminders") {
    const sent = Math.min(3, automations(state, enrich(state.receivables)).length);
    return { ...state, reminderAudit: { sent, at: new Date().toISOString() } };
  }
  if (input.action === "reconcile") {
    const openByCustomer = new Map(enrich(state.receivables).filter((item) => item.balance > 0).map((item) => [item.customer.toLowerCase(), item]));
    const actions = [];
    const payments = state.payments.map((payment) => {
      if (payment.matchedInvoiceId) return payment;
      const candidate = openByCustomer.get(payment.payer.toLowerCase());
      if (!candidate || candidate.balance !== payment.amount) return payment;
      actions.push({ paymentId: payment.id, invoiceId: candidate.id, amount: payment.amount });
      return { ...payment, matchedInvoiceId: candidate.id };
    });
    return { ...state, payments, reconciliationActions: actions };
  }
  throw new Error("Acao nao suportada.");
}
