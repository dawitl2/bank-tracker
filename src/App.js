import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Content from "./Content";
import "./App.css";

function App() {
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");
  const [transactions, setTransactions] = useState([]);

  // 🔥 FETCH ALL TRANSACTIONS ON PAGE LOAD
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch("http://localhost:5000/transactions");
        const data = await res.json();
        setTransactions(data);
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
      }
    };

    fetchTransactions();
  }, []);

  // 🔥 SCRAPER FUNCTION
  const handleScrape = async () => {
    if (!url) return alert("Paste a receipt link!");

    try {
      const res = await fetch("http://localhost:5000/scrape-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error);
        return;
      }

      // Convert scraped data into our table format
      const newTransaction = {
        amount: data["Transferred amount"] || "",
        date: data["Transaction Date"] || "",
        reference: data["Transaction Reference"] || "",
        narrative: data["Narrative"] || "",
      };

      // Add new transaction to the top
      setTransactions((prev) => [newTransaction, ...prev]);

      setShowModal(false);
      setUrl("");
    } catch (err) {
      console.error(err);
      alert("Scraping failed.");
    }
  };

  return (
    <div className="container">
      <Sidebar />
      <Content transactions={transactions} />

      {/* ADD BUTTON */}
      <button className="add-btn" onClick={() => setShowModal(true)}>
        + Add
      </button>

      {/* MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Add Receipt</h2>

            <input
              type="text"
              placeholder="Paste receipt link here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />

            <div className="modal-buttons">
              <button className="scrape-btn" onClick={handleScrape}>
                Scrape
              </button>

              <button className="close-btn" onClick={() => setShowModal(false)}>
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
