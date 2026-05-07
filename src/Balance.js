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
  // ONLY WITHDRAWALS
  // =========================
  const withdrawTransactions = useMemo(() => {
    return transactions.filter(
      tx => tx.is_withdraw !== false
    );
  }, [transactions]);


  // =========================
  // FORMAT DATE
  // =========================
  const formatDate = (dateStr) => {

    if (!dateStr) return "";

    const d = new Date(dateStr);

    if (isNaN(d)) return dateStr;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  };


  // =========================
  // GRAPH DATA
  // =========================
  const processed = useMemo(() => {

    if (!withdrawTransactions.length) return [];

    const sorted = [...withdrawTransactions].sort(
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

      // ✅ correct mapping
      if (tx.flagged === true) {
        mehrt += amount;
      }
      else if (tx.flagged === false) {
        yis += amount;
      }
      else {
        dave += amount;
      }

      // skip some points for cleaner graph
      if (index % 2 === 0 || index === sorted.length - 1) {

        result.push({
          date: formatDate(tx.date),
          Mehrt: Math.round(mehrt),
          Dave: Math.round(dave),
          Yis: Math.round(yis)
        });

      }

    });

    return result;

  }, [withdrawTransactions]);


  // =========================
  // TOTALS
  // =========================
  const totals = useMemo(() => {

    let mehrt = 0;
    let dave = 0;
    let yis = 0;

    withdrawTransactions.forEach(tx => {

      const amount = parseFloat(
        tx.amount?.toString().replace(/,/g, "")
      ) || 0;

      // ✅ correct mapping
      if (tx.flagged === true) {
        mehrt += amount;
      }
      else if (tx.flagged === false) {
        yis += amount;
      }
      else {
        dave += amount;
      }

    });

    return {
      mehrt,
      dave,
      yis
    };

  }, [withdrawTransactions]);


  // =========================
  // PERCENTAGES
  // =========================
  const totalAll =
    totals.mehrt +
    totals.dave +
    totals.yis;

  const percent = (val) =>
    totalAll
      ? ((val / totalAll) * 100).toFixed(1)
      : "0";


  return (
    <div className="balance-page">

      {/* CARD */}
      <img
        src="/card.png"
        className="card"
        alt="bank card"
      />



      {/* APARTMENT BUTTON */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "10px"
        }}
      >
        <button
          className={`construction-toggle ${
            apartmentOnly ? "active" : ""
          }`}
          onClick={() =>
            setApartmentOnly(!apartmentOnly)
          }
        >
          Apartment Only
        </button>
      </div>



      {/* BALANCE GRID */}
      <div className="balance-grid">

        <div>
          <h2>Balance</h2>

          <h1>
            {balance.toLocaleString()}
          </h1>

          {lastWithdraw && (
            <p>
              Last withdraw :
              {" "}
              {lastWithdraw.amount}

              <br />

              {lastWithdraw.date}
            </p>
          )}
        </div>



        <div className="divider"></div>



        <div>
          <h2>Withdraw</h2>

          <h1>
            {totalWithdraw.toLocaleString()}
          </h1>

          {lastWithdraw && (
            <p>
              Last withdraw :
              {" "}
              {lastWithdraw.amount}
            </p>
          )}
        </div>

      </div>



      {/* SUMMARY */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          marginTop: "20px",
          textAlign: "center",
          gap: "10px",
          flexWrap: "wrap"
        }}
      >

        {/* MEHRET */}
        <div>
          <p
            style={{
              color: "#f4a300",
              fontWeight: "600"
            }}
          >
            ● construction
          </p>

          <p>
            {totals.mehrt.toLocaleString()}
          </p>

          <small>
            {percent(totals.mehrt)}%
          </small>
        </div>


        {/* YIS */}
        <div>
          <p
            style={{
              color: "black",
              fontWeight: "600"
            }}
          >
            ● Yiss
          </p>

          <p>
            {totals.yis.toLocaleString()}
          </p>

          <small>
            {percent(totals.yis)}%
          </small>
        </div>


        {/* DAVE */}
        <div>
          <p
            style={{
              color: "red",
              fontWeight: "600"
            }}
          >
            ● Dave
          </p>

          <p>
            {totals.dave.toLocaleString()}
          </p>

          <small>
            {percent(totals.dave)}%
          </small>
        </div>

      </div>



      {/* GRAPH */}
      <div
        style={{
          width: "100%",
          height: 300,
          marginTop: "20px"
        }}
      >

        <ResponsiveContainer>

          <LineChart data={processed}>

            <CartesianGrid strokeDasharray="3 3" />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
            />

            <YAxis
              tick={{ fontSize: 11 }}
            />

            <Tooltip />

            <Line
              type="monotone"
              dataKey="Mehrt"
              stroke="gold"
              strokeWidth={3}
              dot={false}
            />

            <Line
              type="monotone"
              dataKey="Dave"
              stroke="red"
              strokeWidth={3}
              dot={false}
            />

            <Line
              type="monotone"
              dataKey="Yis"
              stroke="black"
              strokeWidth={3}
              dot={false}
            />

          </LineChart>

        </ResponsiveContainer>

      </div>



      {/* GRAPH LABEL */}
      <p
        style={{
          textAlign: "center",
          marginTop: "10px",
          fontSize: "0.9rem"
        }}
      >
        Cumulative withdraw spending over time
      </p>

    </div>
  );
}

export default Balance;