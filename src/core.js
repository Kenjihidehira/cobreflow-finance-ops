import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_PATH = path.join(__dirname, "..", "data", "seed.json");
const DAY = 24 * 60 * 60 * 1000;

export function loadData(filePath = DEFAULT_DATA_PATH) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}

export function daysBetween(date, today = "2026-07-08") {
  const start = new Date(`${date}T12:00:00-03:00`);
  const end = new Date(`${today}T12:00:00-03:00`);
  return Math.floor((end.getTime() - start.getTime()) / DAY);
}

export function getBalance(receivable) {
  return Math.max(0, Number(receivable.amount) - Number(receivable.paid || 0));
}

export function getStatus(receivable, today = "2026-07-08") {
  const balance = getBalance(receivable);
  const overdueDays = daysBetween(receivable.dueDate, today);

  if (balance <= 0) return "paid";
  if (receivable.paid > 0) return "partial";
  if (overdueDays > 0) return "overdue";
  if (overdueDays === 0) return "due_today";
  if (overdueDays >= -2) return "due_soon";
  return "open";
}

export function calculateRiskScore(receivable, today = "2026-07-08") {
  const overdueDays = Math.max(0, daysBetween(receivable.dueDate, today));
  const balance = getBalance(receivable);
  const lastContactGap = receivable.lastContactAt
    ? Math.max(0, daysBetween(receivable.lastContactAt, today))
    : 18;
  const partialPaymentPenalty = receivable.paid > 0 && balance > 0 ? -8 : 0;
  const promiseDiscount = receivable.promiseDate && daysBetween(receivable.promiseDate, today) <= 0 ? -12 : 0;
  const highBalance = Math.min(22, Math.floor(balance / 700));
  const score = 18 + overdueDays * 1.6 + highBalance + Math.min(18, lastContactGap) + partialPaymentPenalty + promiseDiscount;

  return Math.max(0, Math.min(99, Math.round(score)));
}

export function enrichReceivables(receivables, today = "2026-07-08") {
  return receivables.map((item) => {
    const balance = getBalance(item);
    const status = getStatus(item, today);
    const overdueDays = Math.max(0, daysBetween(item.dueDate, today));
    const riskScore = calculateRiskScore(item, today);
    const priority =
      riskScore >= 82 ? "critical" :
      riskScore >= 65 ? "high" :
      riskScore >= 45 ? "medium" : "low";

    return {
      ...item,
      balance,
      status,
      overdueDays,
      riskScore,
      priority
    };
  }).sort((a, b) => b.riskScore - a.riskScore || b.balance - a.balance);
}

export function buildSummary(data, today = "2026-07-08") {
  const receivables = enrichReceivables(data.receivables, today);
  const open = receivables.filter((item) => item.balance > 0);
  const overdue = receivables.filter((item) => item.status === "overdue" || item.status === "partial");
  const dueSoon = receivables.filter((item) => item.status === "due_today" || item.status === "due_soon");
  const matchedPayments = data.payments.filter((payment) => payment.matchedInvoiceId);
  const unmatchedPayments = data.payments.filter((payment) => !payment.matchedInvoiceId);

  return {
    expectedCashIn: open.reduce((sum, item) => sum + item.balance, 0),
    overdueBalance: overdue.reduce((sum, item) => sum + item.balance, 0),
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    highPriorityCount: receivables.filter((item) => item.priority === "critical" || item.priority === "high").length,
    reconciliation: {
      matched: matchedPayments.length,
      pending: unmatchedPayments.length,
      matchedAmount: matchedPayments.reduce((sum, payment) => sum + payment.amount, 0),
      pendingAmount: unmatchedPayments.reduce((sum, payment) => sum + payment.amount, 0)
    },
    channels: open.reduce((acc, item) => {
      acc[item.channel] = (acc[item.channel] || 0) + item.balance;
      return acc;
    }, {})
  };
}

export function buildAutomationQueue(data, today = "2026-07-08") {
  const receivables = enrichReceivables(data.receivables, today).filter((item) => item.balance > 0);

  return receivables.slice(0, 8).map((item) => {
    const rule =
      item.riskScore >= 82 || item.overdueDays > 30
        ? data.automationRules.find((ruleItem) => ruleItem.id === "rule-human-escalation")
        : item.overdueDays > 0
          ? data.automationRules.find((ruleItem) => ruleItem.id === "rule-whatsapp-overdue")
          : data.automationRules.find((ruleItem) => ruleItem.id === "rule-soft-reminder");

    return {
      invoiceId: item.id,
      customer: item.customer,
      balance: item.balance,
      riskScore: item.riskScore,
      priority: item.priority,
      action: rule.name,
      channel: rule.channel,
      reason: item.overdueDays > 0 ? `${item.overdueDays} dias vencido` : "vencimento proximo",
      template: rule.template
    };
  });
}

export function reconcilePayments(data) {
  const receivables = enrichReceivables(data.receivables);
  const openByCustomer = new Map(receivables.filter((item) => item.balance > 0).map((item) => [item.customer.toLowerCase(), item]));
  const actions = [];

  const payments = data.payments.map((payment) => {
    if (payment.matchedInvoiceId) return payment;

    const candidate = openByCustomer.get(payment.payer.toLowerCase());
    if (!candidate || candidate.balance !== payment.amount) return payment;

    actions.push({
      paymentId: payment.id,
      invoiceId: candidate.id,
      customer: candidate.customer,
      amount: payment.amount,
      message: `Pagamento ${payment.method} conciliado automaticamente com ${candidate.id}.`
    });

    return { ...payment, matchedInvoiceId: candidate.id };
  });

  return {
    ...data,
    payments,
    reconciliationActions: actions
  };
}

export function filterReceivables(receivables, { status = "all", channel = "all", search = "" } = {}) {
  const normalized = search.trim().toLowerCase();

  return receivables.filter((item) => {
    const matchesStatus = status === "all" || item.status === status || item.priority === status;
    const matchesChannel = channel === "all" || item.channel.toLowerCase() === channel.toLowerCase();
    const matchesSearch = !normalized || `${item.id} ${item.customer} ${item.customerEmail}`.toLowerCase().includes(normalized);

    return matchesStatus && matchesChannel && matchesSearch;
  });
}
