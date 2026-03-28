function Content({ transactions, constructionOnly, setConstructionOnly }) {
  return (
    <main className="content">

      <div className="transactions-header">
        <h1>Transactions</h1>

        <button
          className={`construction-toggle ${constructionOnly ? "active" : ""}`}
          onClick={() => setConstructionOnly(!constructionOnly)}
        >
          Apartment Only
        </button>
      </div>

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
          {transactions.map((tx, index) => (
            <tr
              key={tx.id}
              className={
                tx.flagged === true
                  ? "flagged-row"
                  : tx.flagged === null
                  ? "null-row"
                  : ""
              }
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
                    style={{
                      textDecoration: "none",
                      fontWeight: "600",
                      color: "#4f46e5",
                      cursor: "pointer"
                    }}
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