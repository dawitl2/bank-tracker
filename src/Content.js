import { useState } from "react";

function Content({
  transactions,
  personFilter,
  setPersonFilter,
  onEditTransaction,
  onDeleteTransaction
}) {
  const [open, setOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

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

  const openActionMenu = (event, tx) => {
    event.preventDefault();

    const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY ?? 0;

    setActionMenu({
      tx,
      x: Math.min(clientX, window.innerWidth - 190),
      y: Math.min(clientY, window.innerHeight - 180)
    });
  };

  const startLongPress = (event, tx) => {
    const timer = setTimeout(() => {
      openActionMenu(event, tx);
    }, 650);

    setLongPressTimer(timer);
  };

  const stopLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleEdit = () => {
    onEditTransaction(actionMenu.tx);
    setActionMenu(null);
  };

  const handleDelete = () => {
    onDeleteTransaction(actionMenu.tx);
    setActionMenu(null);
  };

  const parseAmount = (value) =>
    parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;

  const formatMoney = (value) =>
    Math.round(value || 0).toLocaleString("en-US");

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

  const tableTotal = filteredTransactions.reduce(
    (sum, tx) => sum + parseAmount(tx.amount),
    0
  );

  return (
    <main className="content">
      {actionMenu && (
        <div
          className="row-action-backdrop"
          onClick={() => setActionMenu(null)}
        >
          <div
            className="row-action-menu"
            style={{
              left: actionMenu.x,
              top: actionMenu.y
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={handleEdit}>
              Edit
            </button>

            <button
              className="danger"
              onClick={handleDelete}
            >
              Delete
            </button>

            <button onClick={() => setActionMenu(null)}>
              Close
            </button>
          </div>
        </div>
      )}

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
              className={`${getRowClass(tx)} transaction-row`}
              onContextMenu={(event) => openActionMenu(event, tx)}
              onTouchStart={(event) => startLongPress(event, tx)}
              onTouchEnd={stopLongPress}
              onTouchMove={stopLongPress}
              onTouchCancel={stopLongPress}
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

      <div className="table-total-panel">
        <div>
          <span>Table Total</span>
          <strong>{formatMoney(tableTotal)}</strong>
        </div>
        <small>{filteredTransactions.length} transactions shown</small>
      </div>

    </main>
  );
}

export default Content;
