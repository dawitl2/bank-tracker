import { useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import "./Users.css";

const USERS_LIST = [
  { id: "dawit", name: "Dawit", role: "Administrator", class: "avatar-dawit" },
  { id: "mihret", name: "Mihret", role: "Construction Manager", class: "avatar-mihret" },
  { id: "asnake", name: "Asnake", role: "Project Coordinator", class: "avatar-asnake" },
  { id: "yiss", name: "Yiss", role: "Finance Officer", class: "avatar-yiss" },
  { id: "enku", name: "Enku", role: "Procurement Specialist", class: "avatar-enku" }
];

const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;
const money = (value) => Math.round(value || 0).toLocaleString("en-US");

// Helper to parse dates from transactions
const parseTxDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
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
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

// Categorize transaction narrative
const getCategory = (narrative) => {
  const text = (narrative || "").toLowerCase();
  if (/cement|block|sand|iron|paint|door|window|roof|gypsum|tile|wood|labor|work|worker|site|material|pipe|plumb|brick|stone/i.test(text)) {
    return "Construction";
  }
  if (/transfer|cbe|boa|mobile|sent|received|telebirr|payment/i.test(text)) {
    return "Transfers";
  }
  if (/bill|water|electricity|dstv|telecom|internet|phone|card|recharge/i.test(text)) {
    return "Utilities";
  }
  if (/atm|cash|withdraw|cheque/i.test(text)) {
    return "Cash Withdrawals";
  }
  if (/hotel|cafe|restaurant|food|lunch|dinner|grocery|groceries|supermarket|drink|snack/i.test(text)) {
    return "Food & Dining";
  }
  return "Miscellaneous";
};

export default function Users({ transactions, currentPath, navigate }) {
  // Extract user details path (e.g. /users/dawit or /usersomething/dawit)
  const selectedUserId = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    // If path is like /users/dawit or /usersomething/dawit
    if (parts.length > 1) {
      return parts[1].toLowerCase();
    }
    return null;
  }, [currentPath]);

  const selectedUser = useMemo(() => {
    return USERS_LIST.find((u) => u.id === selectedUserId);
  }, [selectedUserId]);

  // Calculate global summary stats for each user (for the list view)
  const usersSummary = useMemo(() => {
    return USERS_LIST.map((user) => {
      const userTxs = transactions.filter(
        (tx) => (tx.person || "").toLowerCase() === user.id
      );

      let spent = 0;
      let received = 0;

      userTxs.forEach((tx) => {
        const amt = parseAmount(tx.amount);
        if (tx.is_withdraw === false) {
          received += amt;
        } else {
          spent += amt;
        }
      });

      return {
        ...user,
        spent,
        received,
        txCount: userTxs.length
      };
    });
  }, [transactions]);

  // Detailed user metrics & chart computations
  const detailsData = useMemo(() => {
    if (!selectedUser) return null;

    const userTxs = transactions.filter(
      (tx) => (tx.person || "").toLowerCase() === selectedUser.id
    );

    let totalSpent = 0;
    let totalReceived = 0;
    let maxSpent = 0;
    let maxSpentDate = "N/A";

    // Categories breakdown
    const categoryTotals = {
      "Construction": 0,
      "Transfers": 0,
      "Utilities": 0,
      "Cash Withdrawals": 0,
      "Food & Dining": 0,
      "Miscellaneous": 0
    };
    const categoryCounts = {
      "Construction": 0,
      "Transfers": 0,
      "Utilities": 0,
      "Cash Withdrawals": 0,
      "Food & Dining": 0,
      "Miscellaneous": 0
    };

    // Monthly trends
    const monthlyDataMap = {};

    const categorizedTxs = userTxs.map((tx) => {
      const amt = parseAmount(tx.amount);
      const cat = getCategory(tx.narrative);

      if (tx.is_withdraw === false) {
        totalReceived += amt;
      } else {
        totalSpent += amt;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        if (amt > maxSpent) {
          maxSpent = amt;
          maxSpentDate = tx.date || "N/A";
        }
      }

      // Extract month for trend
      const dateObj = parseTxDate(tx.date);
      if (dateObj) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = dateObj.toLocaleString("en-US", { month: "short", year: "2-digit" });

        if (!monthlyDataMap[monthKey]) {
          monthlyDataMap[monthKey] = {
            key: monthKey,
            label: monthLabel,
            Spent: 0,
            Received: 0
          };
        }

        if (tx.is_withdraw === false) {
          monthlyDataMap[monthKey].Received += amt;
        } else {
          monthlyDataMap[monthKey].Spent += amt;
        }
      }

      return {
        ...tx,
        category: cat,
        parsedAmount: amt
      };
    });

    // Format monthly trends chronologically
    const monthlyTrend = Object.values(monthlyDataMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        name: item.label,
        Spent: item.Spent,
        Received: item.Received
      }));

    // Format categories for chart/list
    const categoriesBreakdown = Object.keys(categoryTotals).map((catName) => {
      const amount = categoryTotals[catName];
      const count = categoryCounts[catName];
      const percent = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
      return {
        name: catName,
        value: amount,
        count,
        percent
      };
    }).sort((a, b) => b.value - a.value);

    // Calculate averages
    const withdrawalsOnly = categorizedTxs.filter((tx) => tx.is_withdraw !== false);
    const avgTransaction = withdrawalsOnly.length > 0 ? totalSpent / withdrawalsOnly.length : 0;

    return {
      transactions: categorizedTxs,
      totalSpent,
      totalReceived,
      netFlow: totalReceived - totalSpent,
      avgTransaction,
      maxSpent,
      maxSpentDate,
      categories: categoriesBreakdown,
      monthlyTrend
    };
  }, [selectedUser, transactions]);

  // Render main users list
  if (!selectedUser) {
    return (
      <div className="users-container">
        <div className="transactions-header">
          <h1>People & Spending Summary</h1>
        </div>

        <div className="users-grid">
          {usersSummary.map((user) => (
            <div
              key={user.id}
              className="user-card"
              onClick={() => navigate(`/users/${user.id}`)}
            >
              <div className={`avatar-placeholder ${user.class}`}>
                {user.name.charAt(0)}
              </div>
              <h3>{user.name}</h3>
              <div className="user-role">{user.role}</div>

              <div className="user-card-stats">
                <div className="user-card-stat">
                  <span>Spent</span>
                  <strong>{money(user.spent)}</strong>
                </div>
                <div className="user-card-stat">
                  <span>Tx Count</span>
                  <strong>{user.txCount}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render detailed user view
  const {
    transactions: userTxs,
    totalSpent,
    totalReceived,
    netFlow,
    avgTransaction,
    maxSpent,
    maxSpentDate,
    categories,
    monthlyTrend
  } = detailsData;

  return (
    <div className="users-container">
      {/* Header & Back Button */}
      <div className="user-detail-header">
        <div className="user-profile-summary">
          <div className={`avatar-placeholder avatar-large ${selectedUser.class}`}>
            {selectedUser.name.charAt(0)}
          </div>
          <div className="user-profile-info">
            <h2>{selectedUser.name}</h2>
            <p>{selectedUser.role} &bull; {userTxs.length} Transactions</p>
          </div>
        </div>
        <button className="back-btn" onClick={() => navigate("/users")}>
          &larr; Back to People
        </button>
      </div>

      {/* Metric Cards */}
      <div className="detail-metrics-grid">
        <div className="metric-card spent-card">
          <span>Total Spent</span>
          <strong>{money(totalSpent)} ETB</strong>
        </div>
        <div className="metric-card received-card">
          <span>Total Received</span>
          <strong>{money(totalReceived)} ETB</strong>
        </div>
        <div className="metric-card">
          <span>Net Cashflow</span>
          <strong style={{ color: netFlow >= 0 ? "#53a460" : "#c73939" }}>
            {netFlow >= 0 ? "+" : ""}{money(netFlow)} ETB
          </strong>
        </div>
        <div className="metric-card">
          <span>Average Spent / Tx</span>
          <strong>{money(avgTransaction)} ETB</strong>
        </div>
      </div>

      {/* Charts & Breakdown */}
      <div className="user-analytics-section">
        {/* Left Side: Recharts */}
        <div className="user-charts-wrapper">
          <article className="analytics-card">
            <div className="chart-heading">
              <div>
                <span>Monthly Spending Curve</span>
                <h2>Withdrawals Over Time</h2>
              </div>
            </div>
            <div className="chart-panel" style={{ height: "260px", marginTop: "16px" }}>
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend}>
                    <defs>
                      <linearGradient id="userSpendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f4a300" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#f4a300" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(24, 24, 22, 0.08)" />
                    <XAxis dataKey="name" stroke="#74796e" fontSize={11} tickLine={false} />
                    <YAxis stroke="#74796e" fontSize={11} tickLine={false} tickFormatter={(val) => money(val)} />
                    <Tooltip formatter={(value) => [`${money(value)} ETB`, "Spent"]} />
                    <Area type="monotone" dataKey="Spent" stroke="#f4a300" strokeWidth={3} fill="url(#userSpendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#74796e" }}>
                  No historical trend data available
                </div>
              )}
            </div>
          </article>

          <article className="analytics-card">
            <div className="chart-heading">
              <div>
                <span>Spending by Categories</span>
                <h2>Category Distribution</h2>
              </div>
            </div>
            <div className="chart-panel" style={{ height: "260px", marginTop: "16px" }}>
              {totalSpent > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories.filter((c) => c.value > 0)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(24, 24, 22, 0.08)" />
                    <XAxis dataKey="name" stroke="#74796e" fontSize={10} tickLine={false} />
                    <YAxis stroke="#74796e" fontSize={11} tickLine={false} tickFormatter={(val) => money(val)} />
                    <Tooltip formatter={(value) => [`${money(value)} ETB`, "Spent"]} />
                    <Bar dataKey="value" name="Amount Spent" fill="#20231f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#74796e" }}>
                  No spending categories data available
                </div>
              )}
            </div>
          </article>
        </div>

        {/* Right Side: Category lists & metadata */}
        <div className="categories-card">
          <h3>Spending Breakdown</h3>
          <div className="categories-list">
            {categories.map((cat) => (
              <div key={cat.name} className="category-item">
                <div className="category-info">
                  <span className="category-name">{cat.name}</span>
                  <span className="category-count">
                    {cat.count} txs &bull; {cat.percent}%
                  </span>
                </div>
                <strong className="category-amount">{money(cat.value)} ETB</strong>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "28px", paddingTop: "20px", borderTop: "1px solid rgba(24, 24, 22, 0.06)" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#74796e", fontWeight: "700" }}>
              Largest Single Expense
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
              <strong style={{ fontSize: "18px", fontWeight: "800", color: "#c73939" }}>
                {money(maxSpent)} ETB
              </strong>
              <small style={{ color: "#74796e", fontSize: "12px" }}>
                {maxSpentDate}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* User's Transactions List */}
      <div className="transactions-header" style={{ marginTop: "40px", marginBottom: "20px" }}>
        <h2>Transactions History</h2>
      </div>

      {userTxs.length > 0 ? (
        <table className="transaction-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount</th>
              <th>Date / Time</th>
              <th>Reference no</th>
              <th>Category</th>
              <th>Narrative</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {userTxs.map((tx, idx) => (
              <tr
                key={tx.id}
                className={tx.is_withdraw === false ? "deposit-row" : "transaction-row"}
              >
                <td>{idx + 1}</td>
                <td className="amount">{tx.amount}</td>
                <td>{tx.date}</td>
                <td>{tx.reference}</td>
                <td>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    background: "rgba(24, 24, 22, 0.06)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    color: "#20231f"
                  }}>
                    {tx.category}
                  </span>
                </td>
                <td>{tx.narrative}</td>
                <td className="action">
                  {tx.receipt_url ? (
                    <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="analytics-card" style={{ textAlign: "center", padding: "40px", color: "#74796e" }}>
          No transactions registered for this user
        </div>
      )}
    </div>
  );
}
