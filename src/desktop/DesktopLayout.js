import { useState, useEffect } from "react";
import { 
  FaThLarge, 
  FaExchangeAlt, 
  FaUsers, 
  FaBuilding, 
  FaPercent, 
  FaPlus, 
  FaCalculator,
  FaTimes
} from "react-icons/fa";
import DesktopDashboard from "./DesktopDashboard";
import DesktopTransactions from "./DesktopTransactions";
import DesktopPeople from "./DesktopPeople";
import DesktopConstruction from "./DesktopConstruction";
import DesktopInterest from "./DesktopInterest";
import Calculator from "../Calculator";
import "./DesktopStyles.css";

export default function DesktopLayout(props) {
  const {
    currentPath,
    navigate,
    openReceiptModal,
    showCalculator,
    setShowCalculator,
    calculatorImportValue,
    calculatorImportToken,
  } = props;

  // Active view synced with path
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (currentPath === "/transactions") {
      setActiveTab("transactions");
    } else if (currentPath.startsWith("/balance/people")) {
      setActiveTab("people");
    } else if (currentPath.startsWith("/balance/construction")) {
      setActiveTab("construction");
    } else if (currentPath.startsWith("/balance/interest")) {
      setActiveTab("interest");
    } else if (currentPath.startsWith("/balance")) {
      setActiveTab("dashboard");
    } else {
      setActiveTab("dashboard");
    }
  }, [currentPath]);

  const handleTabClick = (tab) => {
    if (tab === "transactions") {
      navigate("/transactions");
    } else if (tab === "people") {
      navigate("/balance/people");
    } else if (tab === "construction") {
      navigate("/balance/construction");
    } else if (tab === "interest") {
      navigate("/balance/interest");
    } else {
      navigate("/balance");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DesktopDashboard {...props} />;
      case "transactions":
        return <DesktopTransactions {...props} />;
      case "people":
        return <DesktopPeople {...props} />;
      case "construction":
        return <DesktopConstruction {...props} />;
      case "interest":
        return <DesktopInterest {...props} />;
      default:
        return <DesktopDashboard {...props} />;
    }
  };

  return (
    <div className="desktop-app-container">
      {/* Sidebar */}
      <aside className="desktop-sidebar">
        <div className="desktop-sidebar-logo-wrap">
          <img 
            src="/logo.png" 
            alt="Bank of Abyssinia" 
            className="desktop-sidebar-logo"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>

        <nav className="desktop-sidebar-nav">
          <button 
            className={`desktop-sidebar-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => handleTabClick("dashboard")}
          >
            <FaThLarge /> Dashboard
          </button>
          <button 
            className={`desktop-sidebar-nav-item ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => handleTabClick("transactions")}
          >
            <FaExchangeAlt /> Transactions
          </button>
          <button 
            className={`desktop-sidebar-nav-item ${activeTab === "people" ? "active" : ""}`}
            onClick={() => handleTabClick("people")}
          >
            <FaUsers /> People
          </button>
          <button 
            className={`desktop-sidebar-nav-item ${activeTab === "construction" ? "active" : ""}`}
            onClick={() => handleTabClick("construction")}
          >
            <FaBuilding /> Construction
          </button>
          <button 
            className={`desktop-sidebar-nav-item ${activeTab === "interest" ? "active" : ""}`}
            onClick={() => handleTabClick("interest")}
          >
            <FaPercent /> Credit Interest
          </button>
        </nav>

        <div className="desktop-sidebar-footer">
          <span>Bank Tracker Desktop</span>
          <span>v1.3.3</span>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="desktop-main-content">
        {renderContent()}
      </main>

      {/* Floating Action Elements */}
      <div className="desktop-floating-actions">
        {activeTab === "transactions" && (
          <button 
            className="desktop-action-btn-main"
            onClick={openReceiptModal}
            title="Add Receipt"
          >
            <FaPlus />
          </button>
        )}
        <button 
          className="desktop-action-btn-main"
          style={{ background: "#20231f", color: "#ffffff" }}
          onClick={() => setShowCalculator(!showCalculator)}
          title="Calculator"
        >
          <FaCalculator />
        </button>
      </div>

      {/* Side-pane Calculator */}
      {showCalculator && (
        <div className="desktop-inline-calculator">
          <div className="desktop-inline-calculator-header">
            <h3>🧮 Calculator</h3>
            <button 
              className="desktop-inline-calculator-close"
              onClick={() => setShowCalculator(false)}
            >
              <FaTimes />
            </button>
          </div>
          <Calculator 
            importValue={calculatorImportValue}
            importToken={calculatorImportToken}
          />
        </div>
      )}
    </div>
  );
}
