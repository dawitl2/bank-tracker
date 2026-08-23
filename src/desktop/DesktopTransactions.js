import { useState, useMemo } from "react";
import { 
  FaEdit, 
  FaTrash, 
  FaSearch, 
  FaCalculator, 
  FaLink 
} from "react-icons/fa";
import "./DesktopStyles.css";

const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;
const money = (value) => Math.round(value || 0).toLocaleString("en-US");

export default function DesktopTransactions({
  transactions = [],
  people = [],
  personFilter,
  setPersonFilter,
  handleEditTransaction,
  handleDeleteTransaction,
  sendTableTotalToCalculator,
  navigate
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filterOptions = [
    { key: "ALL", label: "ALL" },
    { key: "Withdraw", label: "WITHDRAW" },
    { key: "Deposit", label: "DEPOSIT" },
    ...people.map(p => ({ key: p.name.toUpperCase(), label: p.name.toUpperCase() })),
    { key: "CONSTRUCTION", label: "CONSTRUCTION" }
  ];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const isWithdraw = tx.is_withdraw !== false;
      const isDeposit = tx.is_withdraw === false;
      const person = (tx.person || "").toLowerCase();

      // 1. Text Search matching
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const narrativeMatch = (tx.narrative || "").toLowerCase().includes(query);
        const refMatch = (tx.reference || "").toLowerCase().includes(query);
        const personMatch = (tx.person || "").toLowerCase().includes(query);
        const amountMatch = String(tx.amount || "").includes(query);
        const dateMatch = String(tx.date || "").includes(query);
        if (!narrativeMatch && !refMatch && !personMatch && !amountMatch && !dateMatch) {
          return false;
        }
      }

      // 2. Pill selection matching
      if (personFilter === "ALL") return true;
      if (personFilter === "Withdraw") return isWithdraw;
      if (personFilter === "Deposit") return isDeposit;
      if (personFilter === "CONSTRUCTION") {
        return isWithdraw && (person === "mihret" || person === "asnake" || person === "null");
      }
      return person === personFilter.toLowerCase();
    });
  }, [transactions, personFilter, searchQuery]);

  const tableTotal = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => sum + parseAmount(tx.amount), 0);
  }, [filteredTransactions]);

  const getRowStyleClass = (tx) => {
    const isWithdraw = tx.is_withdraw !== false;
    const person = (tx.person || "").toLowerCase();

    if (!isWithdraw) return "deposit-row";
    if (person === "mihret" || person === "asnake" || tx.person === null) {
      return "construction-row";
    }
    if (person === "dawit") return "dawit-row";
    if (person === "enku") return "enku-row";
    return "";
  };

  return (
    <div className="desktop-main-content" style={{ padding: 0, height: "auto" }}>
      {/* Redesigned section header */}
      <div className="desktop-section-header">
        <div>
          <h1>Ledger Transactions</h1>
          <p style={{ margin: "4px 0 0", color: "var(--desktop-dark-muted)", fontSize: "14px" }}>
            View, search, and manage receipt-based transactions in the system.
          </p>
        </div>
        
        {/* Search Input */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <FaSearch style={{ position: "absolute", left: "12px", color: "var(--desktop-dark-muted)" }} size={14} />
          <input
            type="text"
            className="desktop-search-input"
            style={{ paddingLeft: "36px" }}
            placeholder="Search narrative, ref, person..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile-style Filter Dropdown */}
      <div className="filter-dropdown" style={{ marginBottom: "20px", display: "block", maxWidth: "200px", textAlign: "left" }}>
        <div
          className="dropdown-btn"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          {personFilter || "ALL"}
          <span className={`dropdown-arrow ${dropdownOpen ? "open" : ""}`} style={{ marginLeft: "10px" }}>
            ▼
          </span>
        </div>
        
        <div className={`dropdown-menu ${dropdownOpen ? "open" : ""}`}>
          {filterOptions.map((opt) => (
            <div
              key={opt.key}
              className={`dropdown-item ${personFilter === opt.key ? "selected" : ""}`}
              onClick={() => {
                setPersonFilter(opt.key);
                setDropdownOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Table Card */}
      <div className="desktop-card" style={{ padding: "12px 24px" }}>
        <div className="desktop-table-container">
          <table className="desktop-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>ID</th>
                <th style={{ width: "120px" }}>Person / Group</th>
                <th style={{ width: "140px" }}>Amount</th>
                <th style={{ width: "150px" }}>Date / Time</th>
                <th style={{ width: "150px" }}>Reference</th>
                <th>Narrative</th>
                <th style={{ width: "90px" }}>Receipt</th>
                <th style={{ width: "90px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx, idx) => {
                const isWithdraw = tx.is_withdraw !== false;
                const person = tx.person;

                return (
                  <tr 
                    key={tx.id}
                    className={getRowStyleClass(tx)}
                  >
                    <td style={{ fontWeight: 600, color: "var(--desktop-dark-muted)" }}>{idx + 1}</td>
                    <td>
                      {!isWithdraw ? (
                        <span className="desktop-badge desktop-badge-deposit">Deposit</span>
                      ) : person ? (
                        <button
                          className={`desktop-badge ${
                            person.toLowerCase() === "mihret" || person.toLowerCase() === "asnake"
                              ? "desktop-badge-construction"
                              : "desktop-pill"
                          }`}
                          style={{
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 8px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: person.toLowerCase() === "dawit" ? "rgba(199, 57, 57, 0.1)" : person.toLowerCase() === "enku" ? "rgba(184, 114, 0, 0.1)" : "rgba(0,0,0,0.05)",
                            color: person.toLowerCase() === "dawit" ? "#c73939" : person.toLowerCase() === "enku" ? "#b87200" : "inherit"
                          }}
                          onClick={() => navigate(`/balance/people/${person.toLowerCase()}`)}
                        >
                          {person}
                        </button>
                      ) : (
                        <span className="desktop-badge desktop-badge-construction">—</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 800 }}>ETB {tx.amount}</td>
                    <td style={{ fontSize: "13px", color: "var(--desktop-dark-muted)" }}>{tx.date}</td>
                    <td style={{ fontSize: "13px", fontFamily: "monospace" }}>{tx.reference || "—"}</td>
                    <td style={{ fontSize: "13px" }}>{tx.narrative || "—"}</td>
                    <td>
                      {tx.receipt_url ? (
                        <a
                          href={tx.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="desktop-table-action-btn"
                          style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "var(--desktop-accent)", fontWeight: 600, fontSize: "13px" }}
                        >
                          <FaLink size={12} /> View
                        </a>
                      ) : (
                        <span style={{ color: "var(--desktop-border)" }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px" }}>
                        <button 
                          className="desktop-table-action-btn"
                          onClick={() => handleEditTransaction(tx)}
                          title="Edit Transaction"
                        >
                          <FaEdit size={13} />
                        </button>
                        <button 
                          className="desktop-table-action-btn danger"
                          onClick={() => handleDeleteTransaction(tx)}
                          title="Delete Transaction"
                        >
                          <FaTrash size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "var(--desktop-dark-muted)" }}>
                    No transactions match the selected filter or search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Total Bar */}
      <div className="desktop-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 28px", border: "1px solid rgba(244, 163, 0, 0.25)", background: "rgba(244, 163, 0, 0.03)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <span style={{ color: "var(--desktop-dark-muted)", textTransform: "uppercase", fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px" }}>Table Total</span>
          <strong style={{ fontSize: "22px", fontWeight: 900 }}>ETB {money(tableTotal)}</strong>
        </div>
        <button
          className="desktop-pill active"
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--desktop-dark)", border: "none", color: "#ffffff" }}
          onClick={() => sendTableTotalToCalculator(tableTotal)}
          title="Send total to calculator"
        >
          <FaCalculator /> Send to Calculator
        </button>
      </div>
    </div>
  );
}
