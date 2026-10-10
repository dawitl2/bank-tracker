import { useLanguage } from "./Language";
import { useEffect, useRef, useState } from "react";
import { FaCalculator } from "react-icons/fa";
import { FiCheck, FiChevronDown, FiFilter } from "react-icons/fi";
import ReceiptLink from "./ReceiptLink";
import { formatTransactionAmount } from "./transactionAmount";

function Content({
  transactions,
  personFilter,
  setPersonFilter,
  onEditTransaction,
  onDeleteTransaction,
  onSendTableTotal,
  navigate,
  people = []
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const filterRef = useRef(null);
  const filterActive = personFilter && personFilter !== "ALL";
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = event => { if (!filterRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const [actionMenu, setActionMenu] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

  const options = [
    "ALL",
    "Withdraw",
    "Deposit",
    ...people.map(p => p.name.toUpperCase()),
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
    formatTransactionAmount(value || 0);

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
    const selectedPerson = people.find(entry => entry.name.toUpperCase() === personFilter.toUpperCase());
    return person === (selectedPerson?.id || personFilter).toLowerCase();
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

// ENKU SPECIAL
    if (person === "enku") return "enku-row";

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
            <button onClick={handleEdit}>{t("Edit")}</button>

            <button
              className="danger"
              onClick={handleDelete}
            >{t("Delete")}</button>

            <button onClick={() => setActionMenu(null)}>{t("Close")}</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="transactions-header">

        <h1>{t("Transactions")}</h1>

        {/* CUSTOM DROPDOWN */}
        <div className="filter-dropdown transaction-filter" ref={filterRef} onKeyDown={event => {
          if (event.key === "Escape") { setOpen(false); filterRef.current?.querySelector("button")?.focus(); }
        }}>

          <button type="button"
            className={`dropdown-btn${filterActive ? " is-filtered" : " is-default"}${open ? " is-open" : ""}`}
            aria-label={t("Filter transactions")} aria-expanded={open} aria-controls="transaction-filter-options"
            onClick={() => setOpen(!open)}
          >
            <FiFilter aria-hidden="true" />
            <span>{t(filterActive ? personFilter : "All")}</span>

            <span className={`dropdown-arrow ${open ? "open" : ""}`}>
              <FiChevronDown aria-hidden="true" />
            </span>
          </button>

          <div id="transaction-filter-options" className={`dropdown-menu ${open ? "open" : ""}`} inert={!open}>
            {options.map((opt) => (
              <button type="button" aria-pressed={personFilter === opt}
                key={opt}
                className={`dropdown-item ${
                  personFilter === opt ? "selected" : ""
                }`}
                onClick={() => handleSelect(opt)}
              >
                <span>{t(opt)}</span>{personFilter === opt && <FiCheck aria-hidden="true" />}
              </button>
            ))}
          </div>

        </div>

      </div>

      {/* TABLE */}
      <div className="transaction-scroll-hint" aria-hidden="true">{t("Swipe to see more")}<span>{t("→")}</span>
      </div>
      <table className="transaction-table">

        <thead>
          <tr>
            <th>{t("ID")}</th>
            <th>{t("Person")}</th>
            <th>{t("Amount")}</th>
            <th>{t("Date / Time")}</th>
            <th>{t("Reference no")}</th>
            <th>{t("Narrative")}</th>
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

              <td>{t(index + 1)}</td>
              <td className="person-cell">
                {tx.is_withdraw === false ? (
                  <span className="user-inline-badge badge-deposit">{t("Deposit")}</span>
                ) : tx.person ? (
                  <button
                    type="button"
                    className={`user-inline-badge badge-${tx.person.toLowerCase()}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/balance/people/${tx.person.toLowerCase()}`);
                    }}
                  >
                    {t(tx.person)}
                  </button>
                ) : (
                  <span className="transaction-person-empty">{t("—")}</span>
                )}
              </td>
              <td className="amount">{t(formatTransactionAmount(tx.amount))}</td>
              <td className="date-cell">{tx.date}</td>
              <td>{tx.reference}</td>
              <td>{t(tx.narrative)}</td>

              <td className="action">
                {tx.receipt_url ? (
                  <ReceiptLink transaction={tx}>{t("More")}</ReceiptLink>
                ) : (
                  "-"
                )}
              </td>

            </tr>
          ))}

        </tbody>

      </table>

      <div className="table-total-panel">
        <div className="table-total-main">
          <span>{t("Table Total")}</span>
          <strong>{t(formatMoney(tableTotal))}</strong>
        </div>
        {onSendTableTotal && <button
          type="button"
          className="table-total-send"
          onClick={() => onSendTableTotal?.(tableTotal)}
          title={t("Send table total to calculator")}
          aria-label={t("Send table total to calculator")}
        >
          <FaCalculator />
        </button>}
      </div>

    </main>
  );
}

export default Content;
