function Balance({ balance, lastWithdraw, totalWithdraw }) {
  return (
    <div className="balance-page">

      {/* CARD IMAGE */}
      <img src="/card.png" className="card" alt="bank card" />

      <div className="balance-grid">

        <div>
          <h2>Balance</h2>
          <h1>{balance.toLocaleString()}</h1>

          {lastWithdraw && (
            <p>
              Last withdraw : {lastWithdraw.amount} <br />
              {lastWithdraw.date}
            </p>
          )}
        </div>

        <div className="divider"></div>

        <div>
          <h2>Withdraw</h2>
          <h1>{totalWithdraw.toLocaleString()}</h1>

          {lastWithdraw && (
            <p>
              Last withdraw : {lastWithdraw.amount}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

export default Balance;
