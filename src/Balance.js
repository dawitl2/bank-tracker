import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { FaEye, FaEyeSlash } from "react-icons/fa";


const ANALYTICS_CONFIG = {
  velocityWindowDays: 7,
  annualInterestRate: 0.07,
  interestTaxRate: 0.15,
  personGroups: [
    {
      key: "construction",
      label: "Construction",
      color: "#f4a300",
      match: (person) => person === "mihret" || person === "asnake" || person === "null"
    },
    {
      key: "yiss",
      label: "Yiss",
      color: "#20231f",
      match: (person) => person === "yiss"
    },
    {
      key: "dawit",
      label: "Dawit",
      color: "#c73939",
      match: (person) => person === "dawit"
    },
    {
      key: "other",
      label: "Other",
      color: "#6f7d87",
      match: () => true
    }
  ]
};

const money = (value) =>
  Math.round(value || 0).toLocaleString("en-US");

const parseAmount = (value) =>
  parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;

const parseTxDate = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const text = String(value).trim();
  const bankDate = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/
  );

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

const monthKey = (date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : "Unknown";

const monthLabel = (key) => {
  if (key === "Unknown") return "Unknown";

  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short"
  });
};

const fullMonthLabel = (key) => {
  if (key === "Unknown") return "Unknown month";

  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
};

const getPerson = (tx) =>
  tx.person === null || tx.person === undefined || tx.person === ""
    ? "null"
    : String(tx.person).toLowerCase();

const getGroup = (tx) => {
  const person = getPerson(tx);
  return ANALYTICS_CONFIG.personGroups.find((group) => group.match(person));
};

const getMonthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

function Balance({ balance, transactions = [] }) {
  const [activePanel, setActivePanel] = useState("summary");
  const [showBalance, setShowBalance] = useState(false);

  const analytics = useMemo(() => {
    const enriched = transactions.map((tx) => ({
      ...tx,
      parsedAmount: parseAmount(tx.amount),
      parsedDate: parseTxDate(tx.date) || parseTxDate(tx.created_at),
      group: getGroup(tx)
    }));

    const withdrawals = enriched.filter((tx) => tx.is_withdraw !== false);
    const deposits = enriched.filter((tx) => tx.is_withdraw === false);
    const byNewest = (a, b) =>
      (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0);

    const totalWithdraw = withdrawals.reduce(
      (sum, tx) => sum + tx.parsedAmount,
      0
    );
    const totalDeposit = deposits.reduce((sum, tx) => sum + tx.parsedAmount, 0);
    const lastWithdraw = [...withdrawals].sort(byNewest)[0];
    const lastDeposit = [...deposits].sort(byNewest)[0];

    const groupTotals = ANALYTICS_CONFIG.personGroups.map((group) => {
      const matches = withdrawals.filter((tx) => tx.group?.key === group.key);
      const amount = matches.reduce((sum, tx) => sum + tx.parsedAmount, 0);

      return {
        ...group,
        amount,
        count: matches.length,
        share: totalWithdraw ? (amount / totalWithdraw) * 100 : 0
      };
    });

    const monthMap = new Map();

    enriched.forEach((tx) => {
      const key = monthKey(tx.parsedDate);

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          month: monthLabel(key),
          Withdraw: 0,
          Deposit: 0,
          Net: 0,
          count: 0,
          people: new Set()
        });
      }

      const month = monthMap.get(key);
      const isDeposit = tx.is_withdraw === false;

      if (isDeposit) {
        month.Deposit += tx.parsedAmount;
        month.Net += tx.parsedAmount;
      } else {
        month.Withdraw += tx.parsedAmount;
        month.Net -= tx.parsedAmount;
      }

      month.count += 1;
      month.people.add(getPerson(tx));
    });

    // All months, newest first
    const monthlyTrend = [...monthMap.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((month) => ({
        ...month,
        peopleCount: month.people.size,
        people: undefined
      }));

    const cumulativeTrend = withdrawals
      .filter((tx) => tx.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate)
      .reduce((rows, tx, index) => {
        const previous = rows[rows.length - 1]?.Spend || 0;
        const shouldKeep = index % 2 === 0 || index === withdrawals.length - 1;

        if (shouldKeep) {
          rows.push({
            date: tx.parsedDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric"
            }),
            Spend: previous + tx.parsedAmount
          });
        } else if (rows.length) {
          rows[rows.length - 1].Spend += tx.parsedAmount;
        }

        return rows;
      }, []);

    const netMovement = enriched.reduce((sum, tx) => {
      return tx.is_withdraw === false
        ? sum + tx.parsedAmount
        : sum - tx.parsedAmount;
    }, 0);
    const openingBalance = balance - netMovement;
    const sortedLedger = [...enriched]
      .filter((tx) => tx.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate);
    const { start: monthStart, end: monthEnd } = getMonthBounds();
    let runningBalance = openingBalance;
    let monthMinimumBalance = openingBalance;
    let monthOpeningBalance = openingBalance;

    sortedLedger.forEach((tx) => {
      if (tx.parsedDate < monthStart) {
        runningBalance += tx.is_withdraw === false
          ? tx.parsedAmount
          : -tx.parsedAmount;
        monthOpeningBalance = runningBalance;
        monthMinimumBalance = runningBalance;
        return;
      }

      if (tx.parsedDate <= monthEnd) {
        runningBalance += tx.is_withdraw === false
          ? tx.parsedAmount
          : -tx.parsedAmount;
        monthMinimumBalance = Math.min(monthMinimumBalance, runningBalance);
      }
    });

    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthDays = monthEnd.getDate();
    const elapsedDays = Math.min(
      monthDays,
      Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / dayMs))
    );
    const remainingDays = Math.max(
      0,
      Math.ceil((monthEnd.getTime() - today.getTime()) / dayMs)
    );
    const dailyInterestRate = ANALYTICS_CONFIG.annualInterestRate / 365;
    const grossMonthEstimate =
      monthMinimumBalance * dailyInterestRate * monthDays;
    const netMonthEstimate =
      grossMonthEstimate * (1 - ANALYTICS_CONFIG.interestTaxRate);
    const remainingEstimate =
      monthMinimumBalance *
      dailyInterestRate *
      Math.max(remainingDays, 0) *
      (1 - ANALYTICS_CONFIG.interestTaxRate);

    return {
      totalWithdraw,
      totalDeposit,
      lastWithdraw,
      lastDeposit,
      groupTotals,
      monthlyTrend,
      cumulativeTrend,
      interest: {
        monthLabel: fullMonthLabel(monthKey(monthStart)),
        annualRate: ANALYTICS_CONFIG.annualInterestRate,
        taxRate: ANALYTICS_CONFIG.interestTaxRate,
        monthOpeningBalance,
        minimumBalance: monthMinimumBalance,
        elapsedDays,
        remainingDays,
        monthDays,
        grossMonthEstimate,
        netMonthEstimate,
        remainingEstimate
      }
    };
  }, [balance, transactions]);

  const strongestGroup =
    analytics.groupTotals
      .filter((group) => group.amount > 0)
      .sort((a, b) => b.amount - a.amount)[0] || analytics.groupTotals[0];

  const panelOptions = [
    { key: "summary", label: "Summary" },
    { key: "people", label: "People" },
    { key: "interest", label: "Interest" },
    { key: "charts", label: "Charts" }
  ];

  // For charts, re-sort oldest→newest
  const monthlyTrendAsc = [...analytics.monthlyTrend].sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  return (
    <div className="balance-page balance-dashboard">
      <section className="balance-hero">
        <div className="balance-card-frame">
          <img src="/card.png" className="card" alt="bank card" />
        </div>

        <div className="balance-grid">
          <div className="balance-stat deposit">
            <span>Balance</span>
            <div className="balance-value-wrap">
              <h1>{showBalance ? money(balance) : "••••••••"}</h1>
              <button
                className="balance-visibility-btn"
                onClick={() => setShowBalance(!showBalance)}
                type="button"
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>
              Last deposit: {analytics.lastDeposit?.amount || "-"}
              <br />
              {analytics.lastDeposit?.date || "No deposit yet"}
            </p>
          </div>

          <div className="divider"></div>

          <div className="balance-stat withdraw">
            <span>Withdraw</span>
            <div className="balance-value-wrap">
              <h1>{showBalance ? money(analytics.totalWithdraw) : "••••••••"}</h1>
              <button
                className="balance-visibility-btn"
                onClick={() => setShowBalance(!showBalance)}
                type="button"
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>
              Last withdraw: {analytics.lastWithdraw?.amount || "-"}
              <br />
              {analytics.lastWithdraw?.date || "No withdraw yet"}
            </p>
          </div>
        </div>
      </section>

      <section className="analytics-switcher" aria-label="Balance analytics">
        {panelOptions.map((option) => (
          <button
            key={option.key}
            className={activePanel === option.key ? "active" : ""}
            onClick={() => setActivePanel(option.key)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="balance-panel-stage">
        {activePanel === "summary" && (
          <div className="analytics-layout">
            {analytics.monthlyTrend.map((m) => (
              <article className="analytics-card focus-card" key={m.key}>
                <span>Month Summary</span>
                <h2>{fullMonthLabel(m.key)}</h2>
                <div className="month-summary-grid">
                  <div>
                    <small>Withdraw</small>
                    <strong>{money(m.Withdraw)}</strong>
                  </div>
                  <div>
                    <small>Deposit</small>
                    <strong>{money(m.Deposit)}</strong>
                  </div>
                  <div>
                    <small>People</small>
                    <strong>{m.peopleCount}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {activePanel === "people" && (
          <article className="analytics-card focus-card">
            <span>People Involved</span>
            <h2>{strongestGroup.label}</h2>
            <p>{money(strongestGroup.amount)} is the largest spend lane.</p>
            <div className="people-list">
              {analytics.groupTotals.map((group) => (
                <div className="person-row" key={group.key}>
                  <div>
                    <strong>{group.label}</strong>
                    <small>{group.count} tx</small>
                  </div>
                  <div className="person-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${group.share}%`,
                        backgroundColor: group.color
                      }}
                    ></span>
                  </div>
                  <b>{money(group.amount)}</b>
                </div>
              ))}
            </div>
          </article>
        )}

        {activePanel === "interest" && (
          <article className="analytics-card focus-card interest-card">
            <span>Credit Interest</span>
            <h2>{money(analytics.interest.netMonthEstimate)}</h2>
            <p>
              Based on the lowest balance reached in {analytics.interest.monthLabel}.
            </p>

            <div className="interest-grid">
              <div>
                <small>Minimum balance</small>
                <strong>{money(analytics.interest.minimumBalance)}</strong>
              </div>
              <div>
                <small>Remaining est.</small>
                <strong>{money(analytics.interest.remainingEstimate)}</strong>
              </div>
              <div>
                <small>Remaining day</small>
                <strong>{analytics.interest.remainingDays}</strong>
              </div>
              <div>
                <small>Interest days</small>
                <strong>
                  {analytics.interest.elapsedDays}/{analytics.interest.monthDays}
                </strong>
              </div>
              <div>
                <small>Annual rate</small>
                <strong>{(analytics.interest.annualRate * 100).toFixed(1)}%</strong>
              </div>
              <div>
                <small>Tax held</small>
                <strong>{(analytics.interest.taxRate * 100).toFixed(0)}%</strong>
              </div>
            </div>
          </article>
        )}

        {activePanel === "charts" && (
          <div className="analytics-layout">
            <article className="analytics-card analytics-card-wide">
              <div className="chart-heading">
                <div>
                  <span>Monthly Flow</span>
                  <h2>Withdraw, Deposit, Net</h2>
                </div>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer>
                  <BarChart data={monthlyTrendAsc}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => money(value)} />
                    <Legend />
                    <Bar dataKey="Withdraw" fill="#f4a300" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Deposit" fill="#53a460" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Net" fill="#20231f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="analytics-card analytics-card-wide">
              <div className="chart-heading">
                <div>
                  <span>Spend Curve</span>
                  <h2>Cumulative Withdraw</h2>
                </div>
              </div>
              <div className="chart-panel split-chart">
                <ResponsiveContainer>
                  <AreaChart data={analytics.cumulativeTrend}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f4a300" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#f4a300" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => money(value)} />
                    <Area
                      type="monotone"
                      dataKey="Spend"
                      stroke="#f4a300"
                      strokeWidth={3}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <ResponsiveContainer>
                  <LineChart data={monthlyTrendAsc}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="peopleCount"
                      name="People"
                      stroke="#c73939"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}

export default Balance;
