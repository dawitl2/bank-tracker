function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <img src="logo.png"/>
       </div>

      <nav className="menu">
        <a href="#" className="nav-item">Balance</a>
        <a href="#" className="nav-item active">Transactions</a>
        <a href="#" className="nav-item">Statistics</a>
      </nav>

      <div className="footer-nav">
        <a href="#">Settings</a>
        <a href="#">About</a>
      </div>
    </aside>
  );
}

export default Sidebar;
