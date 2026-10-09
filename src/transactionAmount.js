// Display whole birr without changing the amount used for saving or calculations.
export function formatTransactionAmount(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).replace(/,/g, "").trim();
  const match = text.match(/^(-?)(\d+)(?:\.\d*)?$/);
  if (!match) {
    const amount = Number(text);
    return Number.isFinite(amount) ? Math.trunc(amount).toLocaleString("en-US") : "";
  }
  const whole = match[2].replace(/^0+(?=\d)/, "");
  return `${whole === "0" ? "" : match[1]}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
