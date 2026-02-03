import { useState, useEffect } from "react";
import Content from "./Content";
import Balance from "./Balance";
import "./App.css";

const BASE_BALANCE = 1212518;

function App() {
  const [view, setView] = useState("transactions");
  const [transactions, setTransactions] = useState([]);

  // 🔥 SCRAPER STATES
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetchTransactions();
  }, []);

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

  /*
  ========================================
  SCRAPE RECEIPT
  ========================================
  */

  const handleScrape = async () => {
    if (!url) return alert("Paste receipt link!");

    try {
      const res = await fetch(
        "https://bank-backend-anhp.onrender.com/scrape-receipt",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      // ⭐ Instead of guessing format → just refetch
      await fetchTransactions();

      setShowModal(false);
      setUrl("");
    } catch (err) {
      console.error(err);
      alert("Scraping failed.");
    }
  };

  /*
  ========================================
  CALCULATIONS
  ========================================
  */

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
        <>
          <Content transactions={transactions} />

          {/* 🔥 ADD BUTTON ONLY ON TRANSACTIONS */}
          <button
            className="add-btn"
            onClick={() => setShowModal(true)}
          >
            + Add
          </button>
        </>
      ) : (
        <Balance
          balance={currentBalance}
          lastWithdraw={lastWithdraw}
          totalWithdraw={totalWithdraw}
        />
      )}

      {/* 🔥 MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Receipt</h2>

            <input
              type="text"
              placeholder="Paste receipt link..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <div className="modal-buttons">
              <button className="scrape-btn" onClick={handleScrape}>
                Scrape
              </button>

              <button
                className="close-btn"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
