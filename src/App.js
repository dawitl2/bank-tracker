import { useState, useEffect } from "react";
import Content from "./Content";
import Balance from "./Balance";
import "./App.css";

const BASE_BALANCE = 1212518;

function App() {
  const [view, setView] = useState("transactions");
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch(
          "https://bank-backend-anhp.onrender.com/transactions"
        );
        const data = await res.json();
        setTransactions(data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchTransactions();
  }, []);

  // 🔥 CALCULATIONS
  const totalWithdraw = transactions.reduce((sum, tx) => {
    const num = parseFloat(tx.amount.replace(/,/g, "")) || 0;
    return sum + num;
  }, 0);

  const currentBalance = BASE_BALANCE - totalWithdraw;

  const lastWithdraw = transactions[0];

  return (
    <div className="app">

      {/* LOGO */}
      <img src="/logo.png" className="logo" alt="bank logo" />

      {/* TOGGLE */}
      <div className="toggle">
        <button
          className={view === "transactions" ? "active" : ""}
          onClick={() => setView("transactions")}
        >
          Transactions
        </button>

        <button
          className={view === "balance" ? "active" : ""}
          onClick={() => setView("balance")}
        >
          Balance
        </button>
      </div>

      {/* VIEW SWITCH */}
      {view === "transactions" ? (
        <Content transactions={transactions} />
      ) : (
        <Balance
          balance={currentBalance}
          lastWithdraw={lastWithdraw}
          totalWithdraw={totalWithdraw}
        />
      )}

    </div>
  );
}

export default App;
