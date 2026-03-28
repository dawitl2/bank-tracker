function Balance({ balance, lastWithdraw, totalWithdraw, apartmentOnly, setApartmentOnly }) {
  return (
    <div className="balance-page">

      {/* CARD IMAGE */}
      <img src="/card.png" className="card" alt="bank card" />

      {/* ✅ NEW TOGGLE */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <button
          className={`construction-toggle ${apartmentOnly ? "active" : ""}`}
          onClick={() => setApartmentOnly(!apartmentOnly)}
        >
          Apartment Only
        </button>
      </div>

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