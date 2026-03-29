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
  totalWithdraw,
  transactions = [],
  apartmentOnly,
  setApartmentOnly
}) {

  // =========================
  // FORMAT DATE (Month + Day)
  // =========================
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };

  // =========================
  // PROCESS GRAPH DATA
  // =========================
  const processed = useMemo(() => {

    if (!transactions.length) return [];

    const sorted = [...transactions].sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    let mehrt = 0;
    let dave = 0;
    let yis = 0;

    const result = [];

    sorted.forEach((tx, index) => {

      const amount = parseFloat(
        tx.amount?.toString().replace(/,/g, "")
      ) || 0;

      if (tx.flagged === true) mehrt += amount;
      else if (tx.flagged === false) yis += amount;
      else dave += amount;

      if (index % 2 === 0) {
        result.push({
          date: formatDate(tx.date),
          Mehrt: mehrt,
          Dave: dave,
          Yis: yis
        });
      }
    });

    return result;

  }, [transactions]);

  // =========================
  // TOTALS (for summary)
  // =========================
  const totals = useMemo(() => {

    let mehrt = 0;
    let dave = 0;
    let yis = 0;

    transactions.forEach(tx => {

      const amount = parseFloat(
        tx.amount?.toString().replace(/,/g, "")
      ) || 0;

      if (tx.flagged === true) mehrt += amount;
      else if (tx.flagged === false) yis += amount;
      else dave += amount;

    });

    return { mehrt, dave, yis };

  }, [transactions]);

  const totalAll = totals.mehrt + totals.dave + totals.yis;

  const percent = (val) =>
    totalAll ? ((val / totalAll) * 100).toFixed(1) : "0";

  return (
    <div className="balance-page">

      {/* CARD */}
      <img src="/card.png" className="card" alt="bank card" />

      {/* ✅ APARTMENT ONLY BUTTON (RESTORED) */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <button
          className={`construction-toggle ${apartmentOnly ? "active" : ""}`}
          onClick={() => setApartmentOnly(!apartmentOnly)}
        >
          Apartment Only
        </button>
      </div>

      {/* =========================
          BALANCE + WITHDRAW
      ========================= */}
      <div className="balance-grid">

        <div>
          <h2>Balance</h2>
          <h1>{balance.toLocaleString()}</h1>

          {lastWithdraw && (
            <p>
              Last withdraw : {lastWithdraw.amount} <br />
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
              Last withdraw : {lastWithdraw.amount}
            </p>
          )}
        </div>

      </div>

      {/* =========================
          SUMMARY (SIDE BY SIDE)
      ========================= */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          marginTop: "20px",
          textAlign: "center"
        }}
      >

        <div>
          <p style={{ color: "#f4a300", fontWeight: "600" }}>● Mehret</p>
          <p>{totals.mehrt.toLocaleString()}</p>
          <small>{percent(totals.mehrt)}%</small>
        </div>

        <div>
          <p style={{ color: "black", fontWeight: "600" }}>● Yis</p>
          <p>{totals.yis.toLocaleString()}</p>
          <small>{percent(totals.yis)}%</small>
        </div>

        <div>
          <p style={{ color: "red", fontWeight: "600" }}>● Dave</p>
          <p>{totals.dave.toLocaleString()}</p>
          <small>{percent(totals.dave)}%</small>
        </div>

      </div>

      {/* =========================
          GRAPH
      ========================= */}
      <div style={{ width: "100%", height: 300, marginTop: "20px" }}>
        <ResponsiveContainer>
          <LineChart data={processed}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />

            <Line type="monotone" dataKey="Mehrt" stroke="gold" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Dave" stroke="red" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="Yis" stroke="black" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* GRAPH LABEL */}
      <p style={{ textAlign: "center", marginTop: "10px", fontSize: "0.9rem" }}>
        Cumulative spending over time
      </p>

    </div>
  );
}

export default Balance;