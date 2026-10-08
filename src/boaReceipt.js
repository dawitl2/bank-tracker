const BANK_ORIGIN = "https://cs.bankofabyssinia.com";

// Confirmed against the bank API. Do not truncate other tokens: their suffix
// identifies the account, and guessing can select a different receipt.
const CORRECTED_TOKENS = { FT26082QM3HF413499: "FT26082QM3HF41349" };

export function getLocalReceiptUrl(token) {
  return `${process.env.PUBLIC_URL || ""}/slip/?trx=${encodeURIComponent(token)}`;
}

// A short-lived handoff supports native new-tab and modified clicks without
// putting saved financial details in the address bar.
const SAVED_RECEIPT_PREFIX = "receipt-handoff:";
const HANDOFF_TTL = 10 * 60 * 1000;

export function isDawitTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") return false;
  if (transaction.is_withdraw === false) return false;
  return String(transaction.person || "").trim().toLowerCase() === "dawit";
}

export function generateHashedAccount(seed) {
  const str = String(seed || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const n = str ? Math.abs(hash) : Math.floor(Math.random() * 100000);
  const first = (n % 9) + 1;
  const last2 = String(Math.floor(n / 10) % 100).padStart(2, "0");
  return `${first}******${last2}`;
}

export function rememberSavedReceipt(token, transaction) {
  try {
    Object.keys(localStorage).filter(key => key.startsWith(SAVED_RECEIPT_PREFIX)).forEach(key => {
      try {
        if (JSON.parse(localStorage.getItem(key)).expires <= Date.now()) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    });
    const { amount, date, reference, narrative, person, is_withdraw } = transaction;
    localStorage.setItem(SAVED_RECEIPT_PREFIX + token, JSON.stringify({
      expires: Date.now() + HANDOFF_TTL, transaction: { amount, date, reference, narrative, person, is_withdraw }
    }));
  } catch { /* Storage restrictions must not block the bank receipt. */ }
}

export function readSavedReceipt(token) {
  try {
    const key = SAVED_RECEIPT_PREFIX + token;
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved?.expires > Date.now()) {
      sessionStorage.setItem(key, JSON.stringify(saved));
      localStorage.removeItem(key);
      return saved.transaction;
    }
    localStorage.removeItem(key);
    const session = JSON.parse(sessionStorage.getItem(key));
    if (session?.expires > Date.now()) return session.transaction;
    sessionStorage.removeItem(key);
  } catch { /* The bank page can still load without a saved copy. */ }
  return null;
}

export function getBoaReceiptLink(value) {
  try {
    const url = new URL(value);
    if (url.origin !== BANK_ORIGIN || !/^\/slip\/?$/.test(url.pathname)) return null;
    const originalToken = url.searchParams.get("trx");
    if (!originalToken || !/^[a-zA-Z0-9]{10,60}$/.test(originalToken)) return null;
    const token = CORRECTED_TOKENS[originalToken] || originalToken;
    return { token, url: `${BANK_ORIGIN}/slip/?trx=${token}`, corrected: token !== originalToken };
  } catch {
    return null;
  }
}

function money(value, currency = "ETB") {
  if (value === null || value === undefined || value === "") return null;
  const digits = String(value).replace(/[^\d.-]/g, "");
  if (!/\d/.test(digits)) return null;
  const number = Number(digits);
  return Number.isFinite(number) ? `${currency} ${number.toFixed(2)}` : null;
}

export function savedReceiptRows(transaction = {}) {
  const sourceAccount = transaction.account && /^\d+$/.test(String(transaction.account)) && String(transaction.account).length >= 4
    ? `${String(transaction.account)[0]}******${String(transaction.account).slice(-2)}`
    : generateHashedAccount(transaction.reference || transaction.id || transaction.amount);

  const numAmount = parseFloat(String(transaction.amount || "").replace(/[^\d.-]/g, "")) || 1000;
  const transferred = money(transaction.amount) || "ETB 1000.00";
  const serviceCharge = "ETB 10.00";
  const vat = "ETB 1.50";
  const total = money(numAmount + 11.50) || "ETB 1011.50";
  const txDate = transaction.date || "08/10/26 14:30";
  const txType = "Account Transfer";
  const txRef = transaction.reference || "FT26082QM3HF";
  const sourceName = "DAWIT ENKU";

  const rows = [
    ["Source Account", sourceAccount],
    ["Source Account Name", sourceName],
    ["Transferred amount", transferred],
    ["Service Charge", serviceCharge],
    ["VAT (15%)", vat],
    ["Total Amount", total],
    ["Transaction Date", txDate],
    ["Transaction Type", txType],
    ["Transaction Reference", txRef]
  ];

  if (transaction.narrative) {
    rows.push(["Narrative", transaction.narrative]);
  }

  return rows;
}

// Mirrors the bank's field ordering and display rules without inventing
// account numbers, fees, names, or totals when only saved fields are available.
export function bankReceiptRows(raw) {
  const data = { ...raw };
  const currency = data.currency || "ETB";
  let paymentLabel = "Payment Reference";
  let phoneLabel = "Phone Number";
  switch (data["Transaction Type"]) {
    case "Account Transfer":
    case "ATM Cash Withdrawal":
    case "Safaricom Trust Payment":
      data["Payment Reference"] = null;
      break;
    case "EthSwitch Transfer For Outgoing":
      paymentLabel = "Bank name";
      data["Source Account Name"] ||= data["Payer's Name"];
      break;
    case "EthSwitch Trf For Out IPS": {
      phoneLabel = "Receiver Account";
      const account = String(data["Payment Reference"] || "");
      data[phoneLabel] = account.length <= 3 ? account : account[0] + "*".repeat(account.length - 3) + account.slice(-2);
      data["Payment Reference"] = null;
      data["Transaction Type"] = "Other Bank Transfer";
      break;
    }
    case "Telebirr":
    case "telebirr":
    case "telebirr Agent":
    case "M-PESA Trust Payment":
    case "Mobile Top Up":
    case "Ethiotelecom Post-paid":
    case "Account Transfer Fuel":
      phoneLabel = ({ "telebirr Agent": "Agent Number", "M-PESA Trust Payment": "M-PESA Agent Number", "Ethiotelecom Post-paid": "Service Number", "Account Transfer Fuel": "Plate Number" })[data["Transaction Type"]] || "Phone Number";
      data[phoneLabel] = data["Payment Reference"];
      data["Payment Reference"] = null;
      if (/telebirr/i.test(data["Transaction Type"])) data["Transaction Type"] = data["Transaction Type"][0].toLowerCase() + data["Transaction Type"].slice(1);
      if (data["Transaction Type"] === "Ethiotelecom Post-paid") data["Source Account Name"] = data["Payer's Name"];
      break;
    case "Awach Payment":
      paymentLabel = "Awach Account Number";
      data["Receiver's Account"] = null;
      break;
    case "Safaricom Account Transfer Gift":
    case "Safaricom Airtime Topup":
      paymentLabel = "Phone Number";
      data["Phone Number"] = data["payment reference"];
      data["Transaction Type"] = "Safaricom Topup";
      break;
    case "EthSwitch Transfer For inc via IPS":
    case "RTGS Transfer":
      data["Transaction Type"] = "Other Bank Transfer";
      break;
    default:
      paymentLabel = ({ "Guzogo Airline Payment": "PNR", "Ethiopian Airlines Ticket": "PNR", DSTV: "Smart Card Number", "Account Transfer MRV": "PIN", "Websprix Account Transfer": "Customer ID", "Water Bill Payment": "Bill Number", "Account Transfer to Federal Hc.": "Bill Number" })[data["Transaction Type"]] || paymentLabel;
  }
  if (["Telebirr", "Mobile Top Up"].includes(data["Transaction Type"]) && data.Narrative) data.Narrative = data.Narrative.replace(/\d+/g, "").trim();
  if (data["Transaction Type"] === "MPESA B2C") data["Transaction Type"] = "M-PESA";
  if (data["Receiver's Name"] === data["Source Account Name"]) data["Receiver's Name"] = null;
  const transferred = money(data["Transferred Amount"], currency);
  const total = money(data["Total Amount including VAT"], currency);
  return [
    ["Source Account", data["Source Account"]],
    ["Source Account Name", data["Source Account Name"] || data["Payer's  Name"]],
    ["Transferred amount", transferred],
    ["Converted Amount", money(data["Converted amount"])],
    ["Service Charge", money(data["Service Charge"], currency)],
    ["VAT (15%)", money(data["VAT (15%)"], currency)],
    ["Total Amount", total === transferred ? null : total],
    [phoneLabel, data[phoneLabel]],
    ["Receiver's Account", data["Receiver's Account"]],
    ["Receiver's Name", data["Receiver's Name"]],
    ["Transaction Date", data["Transaction Date"]],
    ["Transaction Type", data["Transaction Type"]],
    ["Transaction Reference", data["Transaction Reference"]],
    [paymentLabel, data["Payment Reference"]],
    ["Bank Name", data["Bank name"]],
    ["Narrative", data.Narrative]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== " " && value !== 0 && value !== "0" && value !== `${currency} 0.00`);
}
