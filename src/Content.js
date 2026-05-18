import { useState } from "react";

function Content({
  transactions,
  personFilter,
  setPersonFilter
}) {
  const [open, setOpen] = useState(false);

  const options = [
    "ALL",
    "Withdraw",
    "Deposit",
    "MIHRET",
    "ASNAKE",
    "YISS",
    "DAWIT",
    "CONSTRUCTION"
  ];

  const handleSelect = (value) => {
    setPersonFilter(value);
    setOpen(false);
  };

  /*
  =========================
  FILTER LOGIC (FIXED)
  =========================
  */

  const filteredTransactions = transactions.filter((tx) => {
    const isWithdraw = tx.is_withdraw === true;
    const isDeposit = tx.is_withdraw === false;

    const person = (tx.person || "").toLowerCase();

    // ALL
    if (personFilter === "ALL") return true;

    // WITHDRAW ONLY
    if (personFilter === "Withdraw") return isWithdraw;

    // DEPOSIT ONLY
    if (personFilter === "Deposit") return isDeposit;

    // CONSTRUCTION (FIXED RULE)
    if (personFilter === "CONSTRUCTION") {
      return (
        isWithdraw === true &&
        (person === "mihret" ||
          person === "asnake" ||
          tx.person === null)
      );
    }

    // INDIVIDUAL PERSON FILTERS
    return person === personFilter.toLowerCase();
  });

  /*
  =========================
  ROW COLORING (FIXED)
  =========================
  */
  const getRowClass = (tx) => {
    const isWithdraw = tx.is_withdraw === true;

    const person = (tx.person || "").toLowerCase();

    // DEPOSIT = LIGHT GREEN (IMPORTANT FIX)
    if (isWithdraw === false) return "deposit-row";

    // CONSTRUCTION GROUP
    if (
      isWithdraw === true &&
      (person === "mihret" ||
        person === "asnake" ||
        tx.person === null)
    ) {
      return "construction-row";
    }

    // DAWIT SPECIAL
    if (person === "dawit") return "dawit-row";

    return "";
  };

  return (
    <main className="content">

      {/* HEADER */}
      <div className="transactions-header">

        <h1>Transactions</h1>

        {/* CUSTOM DROPDOWN */}
        <div className="filter-dropdown">

          <div
            className="dropdown-btn"
            onClick={() => setOpen(!open)}
          >
            {personFilter || "ALL"}

            <span className={`dropdown-arrow ${open ? "open" : ""}`}>
              ▼
            </span>
          </div>

          <div className={`dropdown-menu ${open ? "open" : ""}`}>
            {options.map((opt) => (
              <div
                key={opt}
                className={`dropdown-item ${
                  personFilter === opt ? "selected" : ""
                }`}
                onClick={() => handleSelect(opt)}
              >
                {opt}
              </div>
            ))}
          </div>

        </div>

      </div>

      {/* TABLE */}
      <table className="transaction-table">

        <thead>
          <tr>
            <th>ID</th>
            <th>Amount</th>
            <th>Date / Time</th>
            <th>Reference no</th>
            <th>Narrative</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          {filteredTransactions.map((tx, index) => (
            <tr
              key={tx.id}
              className={getRowClass(tx)}
            >

              <td>{index + 1}</td>
              <td className="amount">{tx.amount}</td>
              <td>{tx.date}</td>
              <td>{tx.reference}</td>
              <td>{tx.narrative}</td>

              <td className="action">
                {tx.receipt_url ? (
                  <a
                    href={tx.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    More
                  </a>
                ) : (
                  "-"
                )}
              </td>

            </tr>
          ))}

        </tbody>

      </table>

    </main>
  );
}

export default Content;