import { useState, useEffect } from "react";
import Content from "./Content";
import Balance from "./Balance";
import Calculator from "./Calculator";
import "./App.css";

const BASE_BALANCE = 1209518;
const VERSION = "1.3.3.6"; // html.css.sys.db
const PASSWORD = "dawit123";
const API_URL =
  process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";
const GENERATED_TRANSACTION_FIELDS = ["id", "created_at"];

function App() {

  const [view, setView] = useState("transactions");
  const [transactions, setTransactions] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);

  // ONLY KEEP THIS FOR BALANCE TAB
  const [constructionOnly, setConstructionOnly] = useState(false);

  // DROPDOWN FILTER
  const [personFilter, setPersonFilter] = useState("ALL");

  // AUTH
  const [authenticated, setAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  useEffect(() => {

    const auth = localStorage.getItem("authenticated");

    if (auth === "true") {
      setAuthenticated(true);
    }

    fetchTransactions();

  }, []);

  const fetchTransactions = async () => {

    try {

      const res = await fetch(`${API_URL}/transactions`);

      const data = await res.json();

      setTransactions(data);

    } catch (err) {

      console.error("FETCH ERROR:", err);

    } finally {

      setLoadingMessage(false);

    }
  };

  const readApiResponse = async (res) => {
    try {
      return await res.json();
    } catch (err) {
      return {
        error: `Request failed with status ${res.status}`
      };
    }
  };

  const handleScrape = async () => {

    if (!url) {
      alert("Paste receipt link!");
      return;
    }

    setScrapeLoading(true);

    try {

      const res = await fetch(
        `${API_URL}/scrape-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ url }),
        }
      );

      const data = await readApiResponse(res);

      if (!res.ok) {
        alert(data.error || "Scraping failed");
        return;
      }

      const fieldTemplate = transactions[0]
        ? Object.fromEntries(
            Object.keys(transactions[0])
              .filter((key) => !GENERATED_TRANSACTION_FIELDS.includes(key))
              .map((key) => [key, ""])
          )
        : {};

      setReceiptDraft({
        ...fieldTemplate,
        ...data
      });

    } catch (err) {

      console.error("SCRAPE ERROR:", err);
      alert("Scraping failed.");

    } finally {

      setScrapeLoading(false);

    }
  };

  const handleDraftChange = (field, value) => {
    setReceiptDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const normalizeDraftValue = (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    return value;
  };

  const handleSaveDraft = async () => {
    if (!receiptDraft) return;

    const transaction = Object.fromEntries(
      Object.entries(receiptDraft)
        .filter(([key]) => !GENERATED_TRANSACTION_FIELDS.includes(key))
        .map(([key, value]) => [key, normalizeDraftValue(value)])
    );

    setDraftSaving(true);

    try {
      if (receiptDraft.id) {
        alert("The backend is still auto-saving during scrape. Deploy the updated backend first so approval creates only one edited row.");
        return;
      }

      const res = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(transaction)
      });

      const data = await readApiResponse(res);

      if (!res.ok) {
        if (res.status === 404) {
          alert("Save endpoint is missing on the backend, and this draft was not auto-saved with an id.");
          return;
        }

        alert(data.details || data.error || "Save failed");
        return;
      }

      await fetchTransactions();
      setReceiptDraft(null);
      setShowModal(false);
      setUrl("");

    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert(err.message || "Save failed.");

    } finally {
      setDraftSaving(false);
    }
  };

  const handleCloseModal = () => {
    if (scrapeLoading || draftSaving) return;

    setShowModal(false);
    setReceiptDraft(null);
    setUrl("");
  };

  const handlePasswordSubmit = () => {

    if (inputPassword === PASSWORD) {

      localStorage.setItem("authenticated", "true");

      setAuthenticated(true);
      setPasswordError(false);

    } else {

      setPasswordError(true);

    }
  };

  /*
  =========================
  TRANSACTION FILTERING
  =========================
  */

  const filteredTransactions = transactions.filter((tx) => {

    if (personFilter === "ALL") {
      return true;
    }

    if (personFilter === "Withdraw") {
      return tx.is_withdraw !== false;
    }

    if (personFilter === "Deposit") {
      return tx.is_withdraw === false;
    }

    if (personFilter === "MIHRET") {
      return tx.person === "mihret";
    }

    if (personFilter === "ASNAKE") {
      return tx.person === "asnake";
    }

    if (personFilter === "YISS") {
      return tx.person === "yiss";
    }

    if (personFilter === "DAWIT") {
      return tx.person === "dawit";
    }

    if (personFilter === "CONSTRUCTION") {

      return (
        tx.person === "mihret" ||
        tx.person === "asnake" ||
        tx.person === null
      );
    }

    return true;

  });

  /*
  =========================
  BALANCE CALCULATION
  =========================
  */

  let totalWithdraw = 0;

  transactions.forEach((tx) => {

    // BALANCE TAB CONSTRUCTION FILTER
    if (
      constructionOnly &&
      tx.person !== "mihret" &&
      tx.person !== "asnake" &&
      tx.person !== null
    ) {
      return;
    }

    const amount = parseFloat(
      tx.amount?.toString().replace(/,/g, "")
    ) || 0;

    // deposits
    if (tx.is_withdraw === false) {
      totalWithdraw -= amount;
    }

    // withdraws
    else {
      totalWithdraw += amount;
    }

  });

  const currentBalance = BASE_BALANCE - totalWithdraw;

  const lastWithdraw = transactions.find(
    tx => tx.is_withdraw !== false
  );

  /*
  =========================
  PASSWORD SCREEN
  =========================
  */

  if (!authenticated) {

    return (
      <div className="password-overlay">

        <div className="password-box">

          <h2>Enter Password</h2>

          <input
            type="password"
            placeholder="Password"
            value={inputPassword}
            onChange={(e) => setInputPassword(e.target.value)}
          />

          <button onClick={handlePasswordSubmit}>
            Submit
          </button>

          {passwordError && (
            <p style={{ color: "red", marginTop: "10px" }}>
              Incorrect password
            </p>
          )}

        </div>

      </div>
    );
  }

  return (
    <div className="app">

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
            </p>

          </div>

        </div>
      )}

      {scrapeLoading && (
        <div className="scrape-loading-overlay">
          <div className="spinner"></div>
          <p>Scraping receipt...</p>
        </div>
      )}

      <img
        src="/logo.png"
        className="logo"
        alt="bank logo"
      />

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

      <div className="content">

        {view === "transactions" ? (
          <>

            <Content
              transactions={filteredTransactions}
              personFilter={personFilter}
              setPersonFilter={setPersonFilter}
            />

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
              transactions={transactions}
              constructionOnly={constructionOnly}
              setConstructionOnly={setConstructionOnly}
            />

            <button
              className="calculator-btn"
              onClick={() => setShowCalculator(!showCalculator)}
            >
              🧮 Calculator
            </button>

          </>
        )}

        {showCalculator && <Calculator />}

      </div>

      <footer className="footer">
        Version {VERSION}
      </footer>

      {showModal && (
        <div className="modal-overlay">

          <div className="modal">

            <h2>Add Receipt</h2>

              <input
                type="text"
                placeholder="Paste receipt link..."
                value={url}
                disabled={scrapeLoading || draftSaving}
                onChange={(e) => setUrl(e.target.value)}
              />

              {receiptDraft && (
                <div className="receipt-draft-box">
                  <h3>Review Receipt</h3>

                  <div className="receipt-draft-grid">
                    {Object.entries(receiptDraft)
                      .filter(([field]) =>
                        !GENERATED_TRANSACTION_FIELDS.includes(field)
                      )
                      .map(([field, value]) => (
                        <label key={field} className="draft-field">
                          <span>{field}</span>

                          {typeof value === "boolean" ? (
                            <select
                              value={String(value)}
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : value === null ? (
                            <input
                              type="text"
                              value="null"
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              value={value ?? ""}
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            />
                          )}
                        </label>
                      ))}
                  </div>
                </div>
              )}

            <div className="modal-buttons">

              <button
                className="scrape-btn"
                onClick={handleScrape}
                disabled={scrapeLoading || draftSaving}
              >
                {receiptDraft ? "Scrape Again" : "Scrape"}
              </button>

              {receiptDraft && (
                <button
                  className="save-draft-btn"
                  onClick={handleSaveDraft}
                  disabled={draftSaving}
                >
                  {draftSaving ? "Saving..." : "Approve & Save"}
                </button>
              )}

              <button
                className="close-btn"
                onClick={handleCloseModal}
                disabled={scrapeLoading || draftSaving}
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
