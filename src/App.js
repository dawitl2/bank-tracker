import { useState, useEffect } from "react";
import Content from "./Content";
import Balance from "./Balance";
import Calculator from "./Calculator";
import "./App.css";

const BASE_BALANCE = 1212518;
const VERSION = "1.3.1.2";

function App() {

  const [view, setView] = useState("transactions");
  const [transactions, setTransactions] = useState([]);

  // scraper states
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");

  // loading message state
  const [loadingMessage, setLoadingMessage] = useState(true);

  // ✅ NEW — calculator visibility
  const [showCalculator, setShowCalculator] = useState(false);



  /*
  ===============================
  FETCH DATA
  ===============================
  */

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

      setLoadingMessage(false);

    } catch (err) {

      console.error("Fetch failed:", err);
      setLoadingMessage(false);
    }
  };



  /*
  ===============================
  SCRAPER
  ===============================
  */

  const handleScrape = async () => {

    if (!url) {
      alert("Paste receipt link!");
      return;
    }

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
        alert(data.error || "Scraping failed");
        return;
      }

      await fetchTransactions();

      setShowModal(false);
      setUrl("");

    } catch (err) {

      console.error("Scrape error:", err);
      alert("Scraping failed.");
    }
  };



  /*
  ===============================
  BALANCE CALCULATIONS
  ===============================
  */

  const totalWithdraw = transactions.reduce((sum, tx) => {

    const num = parseFloat(
      tx.amount?.toString().replace(/,/g, "")
    ) || 0;

    return sum + num;

  }, 0);

  const currentBalance = BASE_BALANCE - totalWithdraw;
  const lastWithdraw = transactions[0];



  return (
    <div className="app">

      {/* LOADING MESSAGE */}
      {loadingMessage && (
        <div className="loading-overlay">
          <div className="loading-box">

            <button
              className="loading-close"
              onClick={() => setLoadingMessage(false)}
            >
              ✕
            </button>

            <p>
              ከባንኩ መረጃ ለመውሰድ ጥቂት ሰከንዶች ሊወስድ ይችላል።
              እባክዎ ትንሽ ይጠብቁ።
            </p>

          </div>
        </div>
      )}



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



      {/* MAIN VIEW */}
      <div className="content">

        {view === "transactions" ? (
          <>
            <Content transactions={transactions} />

            {/* ✅ LEFT Calculator Button */}
          
            {/* ADD BUTTON */}
            <button
              className="add-btn"
              onClick={() => setShowModal(true)}
            >
              +
            </button>

              <button
              className="calculator-btn"
              onClick={() => setShowCalculator(!showCalculator)}
            >
              🧮 Calculator
            </button>

          </>
        ) : (
          <>
            <Balance
              balance={currentBalance}
              lastWithdraw={lastWithdraw}
              totalWithdraw={totalWithdraw}
            />

            {/* ALSO show toggle on balance page */}
            <button
              className="calculator-btn"
              onClick={() => setShowCalculator(!showCalculator)}
            >
              🧮 Calculator
            </button>
          </>
        )}

        {/* ✅ CALCULATOR (Visibility Controlled ONLY) */}
        {showCalculator && <Calculator />}

      </div>



      {/* FOOTER */}
      <footer className="footer">
        Version {VERSION}
      </footer>



      {/* MODAL */}
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

              <button
                className="scrape-btn"
                onClick={handleScrape}
              >
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
