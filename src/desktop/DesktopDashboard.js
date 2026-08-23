import { useState, useMemo } from "react";
import { 
  FaEye, 
  FaEyeSlash, 
  FaLock, 
  FaArrowRight
} from "react-icons/fa";
import "./DesktopStyles.css";

const VISIBILITY_PASSWORD = "pass";
const BASE_BALANCE = 1209518;

const money = (value) => Math.round(value || 0).toLocaleString("en-US");
const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;

const formatSmsMoney = (value) => {
  const parsed = parseAmount(value);
  return parsed ? money(parsed) : "0.0";
};

const formatSmsDate = (value) => {
  if (!value) return "No SMS received yet";
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return "Updated from BOA SMS";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const parseTxDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const bankDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (bankDate) {
    const day = Number(bankDate[1]);
    const month = Number(bankDate[2]) - 1;
    const rawYear = Number(bankDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const hour = Number(bankDate[4] || 0);
    const minute = Number(bankDate[5] || 0);
    return new Date(year, month, day, hour, minute);
  }
  const fallback = new Date(text);
  return isNaN(fallback.getTime()) ? null : fallback;
};

const monthKey = (date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "Unknown";

const fullMonthLabel = (key) => {
  if (key === "Unknown") return "Unknown month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const monthLabel = (key) => {
  if (key === "Unknown") return "Unknown";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
};

const getPerson = (tx) =>
  tx.person === null || tx.person === undefined || tx.person === "" ? "null" : String(tx.person).toLowerCase();

const getGroup = (tx) => {
  const person = getPerson(tx);
  const groups = [
    { key: "construction", match: (p) => p === "mihret" || p === "asnake" || p === "null" },
    { key: "yiss", match: (p) => p === "yiss" },
    { key: "enku", match: (p) => p === "enku" },
    { key: "dawit", match: (p) => p === "dawit" }
  ];
  return groups.find((g) => g.match(person)) || { key: "other" };
};

export default function DesktopDashboard({
  transactions = [],
  boaSmsState,
  boaSmsSummary = [],
  boaSmsLoading = false,
  parkingPayments = [],
  suqePayments = [],
  navigate
}) {
  const getVisibilityDayKey = () => new Date().toISOString().slice(0, 10);
  
  // Independent card visibility states
  const [showRegularBalance, setShowRegularBalance] = useState(false);
  const [showApolloBalance, setShowApolloBalance] = useState(false);

  const [apolloUnlocked, setApolloUnlocked] = useState(
    () => localStorage.getItem("apollo_visibility_day") === getVisibilityDayKey()
  );
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);

  // Compute calculated bank statistics
  const analytics = useMemo(() => {
    const customTxs = [
      ...transactions,
      ...parkingPayments.map(p => ({ ...p, is_withdraw: true, person: "dawit" })),
      ...suqePayments.map(s => ({ ...s, is_withdraw: true, person: "yiss" }))
    ];

    const enriched = customTxs.map((tx) => ({
      ...tx,
      parsedAmount: parseAmount(tx.amount),
      parsedDate: parseTxDate(tx.date) || parseTxDate(tx.created_at),
      group: getGroup(tx)
    }));

    const withdrawals = enriched.filter((tx) => tx.is_withdraw !== false);
    const deposits = enriched.filter((tx) => tx.is_withdraw === false);
    const byNewest = (a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0);

    const totalWithdraw = withdrawals.reduce((sum, tx) => sum + tx.parsedAmount, 0);
    const totalDeposit = deposits.reduce((sum, tx) => sum + tx.parsedAmount, 0);
    const lastWithdraw = [...withdrawals].sort(byNewest)[0];
    const lastDeposit = [...deposits].sort(byNewest)[0];

    const currentBalance = BASE_BALANCE - (totalWithdraw - totalDeposit);

    const monthMap = new Map();
    enriched.forEach((tx) => {
      const key = monthKey(tx.parsedDate);
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, month: monthLabel(key), Withdraw: 0, Deposit: 0, count: 0, people: new Set() });
      }
      const month = monthMap.get(key);
      const isDeposit = tx.is_withdraw === false;
      if (isDeposit) {
        month.Deposit += tx.parsedAmount;
      } else {
        month.Withdraw += tx.parsedAmount;
      }
      month.count += 1;
      month.people.add(getPerson(tx));
    });

    const monthlyTrend = [...monthMap.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((m) => ({
        ...m,
        monthLabel: fullMonthLabel(m.key),
        meta: `${m.people.size} people`
      }));

    return {
      currentBalance,
      totalWithdraw,
      totalDeposit,
      lastWithdraw,
      lastDeposit,
      monthlyTrend
    };
  }, [transactions, parkingPayments, suqePayments]);

  const smsRecentRows = useMemo(() => {
    return boaSmsSummary.map((event, index) => ({
      key: `${event.sms_received_at || "sms"}-${index}`,
      label: event.transaction_type === "deposit" ? "Deposit" : "Withdrawal",
      date: formatSmsDate(event.sms_received_at),
      amount: parseAmount(event.amount),
      balanceAfter: parseAmount(event.balance_after)
    }));
  }, [boaSmsSummary]);

  const handleUnlockSubmit = () => {
    if (passInput === VISIBILITY_PASSWORD) {
      localStorage.setItem("apollo_visibility_day", getVisibilityDayKey());
      setApolloUnlocked(true);
      setUnlockModalOpen(false);
      setPassInput("");
      setUnlockError(false);
    } else {
      setUnlockError(true);
    }
  };

  const hiddenMask = "*****";

  return (
    <div className="desktop-main-content" style={{ padding: 0, height: "auto" }}>
      {/* Redesigned section header */}
      <div className="desktop-section-header">
        <div>
          <h1>Dashboard Overview</h1>
          <p style={{ margin: "4px 0 0", color: "var(--desktop-dark-muted)", fontSize: "14px" }}>
            Real-time accounts tracking for receipts and SMS states.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="desktop-bank-card-container">
        {/* Regular Receipts-based Card */}
        <div className="desktop-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Visual Card Image */}
            <div style={{ flexShrink: 0 }}>
              <img 
                src="/card.png" 
                alt="Bank Card Front" 
                className="desktop-card-image-display" 
              />
            </div>
            {/* Balance Details */}
            <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="desktop-card-balance-lbl" style={{ marginBottom: "2px" }}>Calculated Balance</div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <strong style={{ fontSize: "28px", fontWeight: 900, fontFamily: "monospace" }}>
                  ETB {showRegularBalance ? money(analytics.currentBalance) : hiddenMask}
                </strong>
                <button
                  type="button"
                  onClick={() => setShowRegularBalance(!showRegularBalance)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--desktop-dark-muted)", display: "flex", alignItems: "center" }}
                >
                  {showRegularBalance ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                </button>
              </div>
              <div style={{ fontSize: "13px", color: "var(--desktop-dark-muted)" }}>
                Main Account (Dawit & Family)
              </div>
            </div>
          </div>
          
          <div className="desktop-balance-details-row">
            <div className="desktop-detail-block deposit">
              <label>Total Deposits</label>
              <strong>ETB {money(analytics.totalDeposit)}</strong>
              <span>Last: {analytics.lastDeposit?.amount ? `ETB ${analytics.lastDeposit.amount}` : "—"}</span>
            </div>
            <div className="desktop-detail-block withdraw">
              <label>Total Withdrawals</label>
              <strong>ETB {money(analytics.totalWithdraw)}</strong>
              <span>Last: {analytics.lastWithdraw?.amount ? `ETB ${analytics.lastWithdraw.amount}` : "—"}</span>
            </div>
          </div>
        </div>

        {/* Apollo SMS-based Card */}
        <div className="desktop-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Visual Card Image */}
            <div style={{ flexShrink: 0 }}>
              <img 
                src="/card2.png" 
                alt="Bank Card Back" 
                className="desktop-card-image-display" 
              />
            </div>
            {/* Balance Details */}
            <div style={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="desktop-card-balance-lbl" style={{ marginBottom: "2px" }}>Live Bank State (Apollo)</div>
              
              {boaSmsLoading ? (
                <div>...</div>
              ) : !apolloUnlocked ? (
                <button 
                  className="desktop-pill" 
                  style={{ display: "flex", alignItems: "center", gap: "8px", width: "fit-content", marginTop: "4px" }}
                  onClick={() => setUnlockModalOpen(true)}
                >
                  <FaLock size={12} /> Unlock Live Balance
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <strong style={{ fontSize: "28px", fontWeight: 900, fontFamily: "monospace" }}>
                    ETB {showApolloBalance ? formatSmsMoney(boaSmsState?.current_balance) : hiddenMask}
                  </strong>
                  <button
                    type="button"
                    onClick={() => setShowApolloBalance(!showApolloBalance)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--desktop-dark-muted)", display: "flex", alignItems: "center" }}
                  >
                    {showApolloBalance ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                  </button>
                </div>
              )}
              
              <div style={{ fontSize: "13px", color: "var(--desktop-dark-muted)", marginTop: "4px" }}>
                {boaSmsState?.last_sms_at ? formatSmsDate(boaSmsState.last_sms_at) : "No SMS parsed"}
              </div>
            </div>
          </div>
          
          <div className="desktop-balance-details-row" style={{ border: "1px solid rgba(42, 157, 143, 0.15)", background: "rgba(42, 157, 143, 0.03)" }}>
            <div className="desktop-detail-block deposit">
              <label>Latest SMS Deposit</label>
              <strong>
                {!apolloUnlocked ? (
                  hiddenMask
                ) : (
                  `ETB ${formatSmsMoney(boaSmsState?.latest_deposit_amount)}`
                )}
              </strong>
              <span>{boaSmsState?.deposit_updated_at ? formatSmsDate(boaSmsState.deposit_updated_at) : "—"}</span>
            </div>
            <div className="desktop-detail-block withdraw">
              <label>Latest SMS Withdrawal</label>
              <strong>
                {!apolloUnlocked ? (
                  hiddenMask
                ) : (
                  `ETB ${formatSmsMoney(boaSmsState?.latest_withdrawal_amount)}`
                )}
              </strong>
              <span>{boaSmsState?.withdrawal_updated_at ? formatSmsDate(boaSmsState.withdrawal_updated_at) : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Lists Grid */}
      <div className="desktop-grid-dashboard">
        {/* Receipt-based Month Summary */}
        <div className="desktop-card">
          <div className="desktop-card-title">
            <span>Month Summaries (Receipts)</span>
            <button className="desktop-table-action-btn" onClick={() => navigate("/transactions")}>
              Ledger <FaArrowRight size={10} />
            </button>
          </div>
          
          <div className="desktop-table-container">
            <table className="desktop-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>People</th>
                  <th>Deposited</th>
                  <th>Withdrawn</th>
                </tr>
              </thead>
              <tbody>
                {analytics.monthlyTrend.slice(0, 5).map((m) => (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 700 }}>{m.monthLabel}</td>
                    <td>{m.meta}</td>
                    <td style={{ color: "var(--desktop-color-deposit)" }}>ETB {money(m.Deposit)}</td>
                    <td style={{ color: "var(--desktop-color-withdraw)" }}>ETB {money(m.Withdraw)}</td>
                  </tr>
                ))}
                {analytics.monthlyTrend.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", color: "var(--desktop-dark-muted)" }}>
                      No receipt-based monthly data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Apollo SMS transactions list */}
        <div className="desktop-card">
          <div className="desktop-card-title">
            <span>Recent BOA SMS Events</span>
            {apolloUnlocked ? (
              <span className="desktop-badge" style={{ background: "rgba(42, 157, 143, 0.1)", color: "#2a9d8f", textTransform: "uppercase", fontSize: "10px" }}>Live Syncing</span>
            ) : (
              <FaLock size={12} style={{ color: "var(--desktop-dark-muted)" }} />
            )}
          </div>

          <div className="desktop-table-container">
            {!apolloUnlocked ? (
              <div style={{ display: "flex", flexDirection: "column", alignSelf: "center", alignItems: "center", justifyContent: "center", minHeight: "180px", color: "var(--desktop-dark-muted)" }}>
                <FaLock size={28} style={{ marginBottom: "12px", color: "var(--desktop-border)" }} />
                <span>SMS transactions are locked.</span>
                <button 
                  className="desktop-pill" 
                  style={{ marginTop: "12px" }}
                  onClick={() => setUnlockModalOpen(true)}
                >
                  Unlock Live Sync
                </button>
              </div>
            ) : smsRecentRows.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--desktop-dark-muted)", padding: "40px 0" }}>
                Waiting for SMS events to arrive from the companion app...
              </div>
            ) : (
              <table className="desktop-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {smsRecentRows.slice(0, 5).map((event) => (
                    <tr key={event.key}>
                      <td>
                        <span className={`desktop-badge ${event.label === "Deposit" ? "desktop-badge-deposit" : "desktop-badge-withdraw"}`}>
                          {event.label}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--desktop-dark-muted)" }}>{event.date}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>ETB {money(event.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Apollo Password Verification modal */}
      {unlockModalOpen && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>Unlock Live Apollo State</h2>
            <p style={{ fontSize: "14px", color: "var(--desktop-dark-muted)", marginTop: "-10px", marginBottom: "20px" }}>
              Please enter the security password to view live SMS transactions.
            </p>
            <input 
              type="password"
              placeholder="Enter password..."
              value={passInput}
              onChange={(e) => { setPassInput(e.target.value); setUnlockError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleUnlockSubmit(); }}
              autoFocus
            />
            {unlockError && (
              <p style={{ color: "var(--desktop-color-withdraw)", fontSize: "12px", margin: "-10px 0 14px" }}>
                Incorrect password!
              </p>
            )}
            <div style={{ display: "flex", gap: "10px" }}>
              <button 
                onClick={() => { setUnlockModalOpen(false); setPassInput(""); setUnlockError(false); }}
                style={{ background: "rgba(0,0,0,0.05)", color: "var(--desktop-dark)" }}
              >
                Cancel
              </button>
              <button onClick={handleUnlockSubmit}>
                Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
