function Content({ transactions }) {
  return (
    <main className="content">

      <h1>Transactions</h1>

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
            <tr key={tx.id}>
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
