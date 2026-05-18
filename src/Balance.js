import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

function Balance({
  balance,
  lastWithdraw,
  transactions = []
}) {

  // =========================
  // ONLY WITHDRAWALS (FIXED SOURCE OF TRUTH)
  // =========================
  const withdrawTransactions = useMemo(() => {
    return transactions.filter(tx => tx.is_withdraw === true);
  }, [transactions]);


  // =========================
  // CATEGORY RULE
  // =========================
  const getCategory = (tx) => {
    const person = (tx.person || "").toLowerCase();

    // construction rule
    if (person === "mihret" || person === "asnake" || tx.person === null) {
      return "construction";
    }

    if (person === "yiss") return "yiss";
    if (person === "dawit") return "dave";

    return "other";
  };


  // =========================
  // GRAPH DATA (FIXED)
  // =========================
  const processed = useMemo(() => {
    if (!withdrawTransactions.length) return [];

    const sorted = [...withdrawTransactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let construction = 0;
    let yiss = 0;
    let dave = 0;

    const result = [];

    sorted.forEach((tx, index) => {
      const amount =
        parseFloat(tx.amount?.toString().replace(/,/g, "")) || 0;

      const category = getCategory(tx);

      if (category === "construction") construction += amount;
      if (category === "yiss") yiss += amount;
      if (category === "dave") dave += amount;

      if (index % 2 === 0 || index === sorted.length - 1) {
        result.push({
          date: new Date(tx.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          }),
          Construction: construction,
          Yiss: yiss,
          Dave: dave
        });
      }
    });

    return result;
  }, [withdrawTransactions]);


  // =========================
  // TOTALS (FIXED)
  // =========================
  const totals = useMemo(() => {
    let construction = 0;
    let yiss = 0;
    let dave = 0;

    withdrawTransactions.forEach(tx => {
      const amount =
        parseFloat(tx.amount?.toString().replace(/,/g, "")) || 0;

      const category = getCategory(tx);

      if (category === "construction") construction += amount;
      if (category === "yiss") yiss += amount;
      if (category === "dave") dave += amount;
    });

    return { construction, yiss, dave };
  }, [withdrawTransactions]);


  const totalWithdraw =
    totals.construction + totals.yiss + totals.dave;

  const percent = (val) =>
    totalWithdraw ? ((val / totalWithdraw) * 100).toFixed(1) : "0";


  return (
    <div className="balance-page">

      <img src="/card.png" className="card" alt="bank card" />

      {/* BALANCE GRID */}
      <div className="balance-grid">

        <div>
          <h2>Balance</h2>
          <h1>{balance.toLocaleString()}</h1>

          {lastWithdraw && (
            <p>
              Last withdraw: {lastWithdraw.amount}
              <br />
              {lastWithdraw.date}
            </p>
          )}
        </div>

        <div className="divider"></div>

        <div>
          <h2>Withdraw</h2>
          <h1>{totalWithdraw.toLocaleString()}</h1>

          {lastWithdraw && (
            <p>
              Last withdraw: {lastWithdraw.amount}
            </p>
          )}
        </div>

      </div>

      {/* SUMMARY */}
      <div style={{ display: "flex", justifyContent: "space-around" }}>

        <div>
          <p style={{ color: "#f4a300" }}>Construction</p>
          <p>{totals.construction.toLocaleString()}</p>
          <small>{percent(totals.construction)}%</small>
        </div>

        <div>
          <p style={{ color: "black" }}>Yiss</p>
          <p>{totals.yiss.toLocaleString()}</p>
          <small>{percent(totals.yiss)}%</small>
        </div>

        <div>
          <p style={{ color: "red" }}>Dave</p>
          <p>{totals.dave.toLocaleString()}</p>
          <small>{percent(totals.dave)}%</small>
        </div>

      </div>

      {/* GRAPH */}
      <div style={{ width: "100%", height: 300, marginTop: "20px" }}>
        <ResponsiveContainer>
          <LineChart data={processed}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />

            <Line type="monotone" dataKey="Construction" stroke="gold" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Yiss" stroke="black" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Dave" stroke="red" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

export default Balance;