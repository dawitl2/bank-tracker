function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo-container">
        <img
          src="/logo.png"
          alt="Bank Logo"
          className="main-logo"
        />
      </div>

      <nav className="menu">
        <button className="nav-item">Balance</button>
        <button className="nav-item active">Transactions</button>
        <button className="nav-item">Statistics</button>
      </nav>
    </aside>
  );
}

export default Sidebar;
