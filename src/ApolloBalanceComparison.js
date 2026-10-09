import { formatTransactionAmount } from "./transactionAmount";
import "./ApolloBalanceComparison.css";

const balanceValue = value => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const amount = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
};

export default function ApolloBalanceComparison({ apolloBalance, regularBalance, loading = false, locked = false, hidden = true }) {
  const apollo = balanceValue(apolloBalance);
  const regular = balanceValue(regularBalance);
  let label = "Difference", amount = "—", tone = "neutral";
  if (locked || hidden) amount = "*****";
  else if (loading) amount = "...";
  else if (apollo !== null && regular !== null) {
    const difference = apollo - regular;
    if (Math.abs(difference) < 1e-8) {
      label = "Balanced";
      amount = "0";
    } else {
      tone = difference > 0 ? "surplus" : "deficit";
      label = difference > 0 ? "Surplus" : "Deficit";
      amount = `${difference > 0 ? "+" : "−"}${formatTransactionAmount(Math.abs(difference))}`;
    }
  }
  return (
    <div className={`account-activity-row apollo-balance-comparison is-${tone}`} role="group" aria-label="Apollo balance compared with regular balance">
      <span>{label}</span>
      <strong>{amount} ETB</strong>
    </div>
  );
}
