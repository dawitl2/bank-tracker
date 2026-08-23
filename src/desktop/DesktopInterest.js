import { useState, useMemo } from "react";
import { 
  FaLock, 
  FaEye, 
  FaEyeSlash, 
  FaInfoCircle, 
  FaChartLine 
} from "react-icons/fa";
import "./DesktopStyles.css";

const VISIBILITY_PASSWORD = "pass";
const BASE_BALANCE = 1209518;
const ANNUAL_RATE = 0.07;
const TAX_RATE = 0.05;

const money = (value) => Math.round(value || 0).toLocaleString("en-US");
const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;

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

const getMonthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export default function DesktopInterest({
  transactions = [],
  currentBalance = BASE_BALANCE,
  parkingPayments = [],
  suqePayments = []
}) {
  const getVisibilityDayKey = () => new Date().toISOString().slice(0, 10);
  
  const [showInterest, setShowInterest] = useState(
    () => localStorage.getItem("interest_visibility_day") === getVisibilityDayKey()
  );
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);

  // Compute interest details
  const interestData = useMemo(() => {
    // combine transactions
    const customTxs = [
      ...transactions,
      ...parkingPayments.map(p => ({ ...p, is_withdraw: true, person: "dawit" })),
      ...suqePayments.map(s => ({ ...s, is_withdraw: true, person: "yiss" }))
    ];

    const enriched = customTxs.map((tx) => ({
      ...tx,
      parsedAmount: parseAmount(tx.amount),
      parsedDate: parseTxDate(tx.date) || parseTxDate(tx.created_at)
    }));

    // calculate running balance history
    let totalWithdraw = 0;
    customTxs.forEach((tx) => {
      const amount = parseAmount(tx.amount);
      if (tx.is_withdraw === false) {
        totalWithdraw -= amount;
      } else {
        totalWithdraw += amount;
      }
    });

    const currentBalanceCalc = BASE_BALANCE - totalWithdraw;
    const netMovement = enriched.reduce((sum, tx) => tx.is_withdraw === false ? sum + tx.parsedAmount : sum - tx.parsedAmount, 0);
    const openingBalance = currentBalanceCalc - netMovement;

    const sortedLedger = enriched.filter((tx) => tx.parsedDate).sort((a, b) => a.parsedDate - b.parsedDate);
    const { start: monthStart, end: monthEnd } = getMonthBounds();
    
    let runningBalance = openingBalance;
    let monthMinimumBalance = openingBalance;
    let monthOpeningBalance = openingBalance;

    sortedLedger.forEach((tx) => {
      if (tx.parsedDate < monthStart) {
        runningBalance += tx.is_withdraw === false ? tx.parsedAmount : -tx.parsedAmount;
        monthOpeningBalance = runningBalance;
        monthMinimumBalance = runningBalance;
        return;
      }
      if (tx.parsedDate <= monthEnd) {
        runningBalance += tx.is_withdraw === false ? tx.parsedAmount : -tx.parsedAmount;
        monthMinimumBalance = Math.min(monthMinimumBalance, runningBalance);
      }
    });

    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthDays = monthEnd.getDate();
    const elapsedDays = Math.min(monthDays, Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / dayMs)));
    const remainingDays = Math.max(0, Math.ceil((monthEnd.getTime() - today.getTime()) / dayMs));
    
    const dailyInterestRate = ANNUAL_RATE / 365;
    const grossMonthEstimate = monthMinimumBalance * dailyInterestRate * monthDays;
    const netMonthEstimate = grossMonthEstimate * (1 - TAX_RATE);
    const remainingEstimate = monthMinimumBalance * dailyInterestRate * Math.max(remainingDays, 0) * (1 - TAX_RATE);

    return {
      monthLabel: fullMonthLabel(monthKey(monthStart)),
      monthOpeningBalance,
      minimumBalance: monthMinimumBalance,
      elapsedDays,
      remainingDays,
      monthDays,
      grossMonthEstimate,
      netMonthEstimate,
      remainingEstimate
    };
  }, [transactions, parkingPayments, suqePayments]);

  const handleUnlockSubmit = () => {
    if (passInput === VISIBILITY_PASSWORD) {
      localStorage.setItem("interest_visibility_day", getVisibilityDayKey());
      setShowInterest(true);
      setUnlockModalOpen(false);
      setPassInput("");
      setUnlockError(false);
    } else {
      setUnlockError(true);
    }
  };

  const requestLockToggle = () => {
    if (showInterest) {
      setShowInterest(false);
    } else {
      setUnlockModalOpen(true);
    }
  };



  return (
    <div className="desktop-main-content" style={{ padding: 0, height: "auto" }}>
      {/* Redesigned section header */}
      <div className="desktop-section-header">
        <div>
          <h1>Credit Interest Calculator</h1>
          <p style={{ margin: "4px 0 0", color: "var(--desktop-dark-muted)", fontSize: "14px" }}>
            Analyze estimated monthly interest returns based on historical ledger minimums.
          </p>
        </div>
        <button 
          className={`desktop-pill ${showInterest ? "active accent" : ""}`}
          onClick={requestLockToggle}
        >
          {showInterest ? <><FaEyeSlash /> Lock Calculations</> : <><FaEye /> Unlock Calculations</>}
        </button>
      </div>

      {/* Split Details Grid */}
      <div className="desktop-grid-2">
        {/* Left Side: Calculations Card */}
        <div className="desktop-card" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="desktop-card-title">
            <span>Interest Calculations ({interestData.monthLabel})</span>
            {showInterest ? (
              <span className="desktop-badge desktop-badge-deposit" style={{ fontSize: "10px", textTransform: "uppercase" }}>Unlocked</span>
            ) : (
              <span className="desktop-badge desktop-badge-withdraw" style={{ fontSize: "10px", textTransform: "uppercase" }}>Locked</span>
            )}
          </div>

          {!showInterest ? (
            /* Locked State visualizer */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "280px", color: "var(--desktop-dark-muted)" }}>
              <FaLock size={36} style={{ color: "var(--desktop-border)", marginBottom: "16px" }} />
              <h3>Credit Interest values are locked</h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", textAlign: "center" }}>
                Authentication is required to view estimated interest yields and minimum balances.
              </p>
              <button 
                className="desktop-pill active" 
                style={{ marginTop: "16px", background: "var(--desktop-dark)", color: "#ffffff", border: "none" }}
                onClick={() => setUnlockModalOpen(true)}
              >
                Unlock Calculations
              </button>
            </div>
          ) : (
            /* Unlocked metrics grid */
            <>
              <div className="desktop-balance-details-row" style={{ marginTop: 0, gridTemplateColumns: "1fr", background: "rgba(82, 183, 136, 0.05)", border: "1px solid rgba(82, 183, 136, 0.2)" }}>
                <div className="desktop-detail-block deposit" style={{ alignItems: "center", padding: "12px 0" }}>
                  <label style={{ fontSize: "13px" }}>Estimated Net Monthly Interest Return</label>
                  <strong style={{ fontSize: "32px", fontWeight: 900 }}>ETB {money(interestData.netMonthEstimate)}</strong>
                  <span style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", marginTop: "4px" }}>
                    Calculated after {TAX_RATE * 100}% deduction (ETB {money(interestData.grossMonthEstimate - interestData.netMonthEstimate)})
                  </span>
                </div>
              </div>

              <div className="desktop-grid-2">
                <div className="desktop-card" style={{ padding: "16px 20px" }}>
                  <div className="desktop-detail-block">
                    <label>Lowest Ledger Balance</label>
                    <strong style={{ fontSize: "20px" }}>ETB {money(interestData.minimumBalance)}</strong>
                    <span style={{ fontSize: "12px" }}>Opening: ETB {money(interestData.monthOpeningBalance)}</span>
                  </div>
                </div>

                <div className="desktop-card" style={{ padding: "16px 20px" }}>
                  <div className="desktop-detail-block">
                    <label>Remaining Days Yield</label>
                    <strong style={{ fontSize: "20px" }}>ETB {money(interestData.remainingEstimate)}</strong>
                    <span style={{ fontSize: "12px" }}>Days Left: {interestData.remainingDays} days</span>
                  </div>
                </div>
              </div>

              <div className="desktop-grid-3" style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid var(--desktop-border)" }}>
                <div className="desktop-detail-block" style={{ textAlign: "center" }}>
                  <label style={{ fontSize: "10px" }}>Annual Rate</label>
                  <strong style={{ fontSize: "16px" }}>{(ANNUAL_RATE * 100).toFixed(1)}%</strong>
                </div>
                <div className="desktop-detail-block" style={{ textAlign: "center" }}>
                  <label style={{ fontSize: "10px" }}>Active Days</label>
                  <strong style={{ fontSize: "16px" }}>{interestData.elapsedDays} / {interestData.monthDays}</strong>
                </div>
                <div className="desktop-detail-block" style={{ textAlign: "center" }}>
                  <label style={{ fontSize: "10px" }}>Tax Rate</label>
                  <strong style={{ fontSize: "16px" }}>{(TAX_RATE * 100).toFixed(0)}%</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Side: Educational Guide */}
        <div className="desktop-card" style={{ display: "flex", flexDirection: "column", gap: "20px", background: "rgba(244, 163, 0, 0.02)", border: "1px solid rgba(244, 163, 0, 0.12)" }}>
          <div className="desktop-card-title">
            <span style={{ color: "var(--desktop-accent)", display: "flex", alignItems: "center", gap: "8px" }}><FaInfoCircle /> Calculations Guide</span>
          </div>
          
          <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#4f554a" }}>
            <p style={{ marginTop: 0 }}>
              Credit interest estimates are derived from Bank of Abyssinia's standard saving rates and guidelines:
            </p>
            <ul style={{ paddingLeft: "20px", margin: "16px 0", display: "flex", flexDirection: "column", gap: "12px" }}>
              <li>
                <strong>Minimum Balance Rule</strong>: Interest is calculated strictly using the <em>lowest balance reached</em> in the account during the calendar month, rather than average balances.
              </li>
              <li>
                <strong>Annual Rate Yield</strong>: Calculated daily based on the annual interest rate of <strong>{(ANNUAL_RATE * 100).toFixed(1)}%</strong>.
              </li>
              <li>
                <strong>Tax Deductions</strong>: Under Ethiopian banking regulations, a standard <strong>{(TAX_RATE * 100).toFixed(0)}%</strong> tax is deducted from the gross interest earnings.
              </li>
              <li>
                <strong>Real-time update</strong>: Transactions added to the receipts database immediately update the lowest balance calculation for the active month.
              </li>
            </ul>
            <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "rgba(0,0,0,0.03)", padding: "12px 16px", borderRadius: "6px", marginTop: "24px", color: "var(--desktop-dark)" }}>
              <FaChartLine style={{ color: "var(--desktop-accent)" }} />
              <span style={{ fontSize: "12px" }}>Keep account minimum balances high to maximize monthly interest yields.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Password Overlay */}
      {unlockModalOpen && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>Unlock Credit Interest</h2>
            <p style={{ fontSize: "14px", color: "var(--desktop-dark-muted)", marginTop: "-10px", marginBottom: "20px" }}>
              Please enter the security password to view interest projections.
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
