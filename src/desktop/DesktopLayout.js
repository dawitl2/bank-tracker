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
    onCalculatorStateChange,
  } = props;

  // Active view synced with path
  const [activeTab, setActiveTab] = useState("dashboard");

  // Draggable Calculator State
  const [calcPos, setCalcPos] = useState({ x: window.innerWidth - 350, y: window.innerHeight - 520 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // Handle calculator dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setCalcPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    // Only allow dragging from header
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - calcPos.x,
      y: e.clientY - calcPos.y
    });
  };

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
        {/* Click logo to go to dashboard */}
        <div 
          className="desktop-sidebar-logo-wrap"
          onClick={() => handleTabClick("dashboard")}
          title="Go to Dashboard"
        >
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

        {/* Sidebar integrated quick action buttons */}
        <div className="desktop-sidebar-actions-container">
          {activeTab === "transactions" && (
            <button 
              className="desktop-sidebar-action-btn primary"
              onClick={openReceiptModal}
            >
              <FaPlus /> Add Receipt
            </button>
          )}
          <button 
            className="desktop-sidebar-action-btn"
            onClick={() => setShowCalculator(!showCalculator)}
          >
            <FaCalculator /> Calculator
          </button>
        </div>

        <div className="desktop-sidebar-footer">
          <span>Bank Tracker Desktop</span>
          <span>v1.3.3</span>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="desktop-main-content">
        {renderContent()}
      </main>

      {/* Draggable side-pane Calculator */}
      {showCalculator && (
        <div 
          className="desktop-inline-calculator"
          style={{
            left: `${calcPos.x}px`,
            top: `${calcPos.y}px`,
            position: "fixed"
          }}
        >
          <div 
            className="desktop-inline-calculator-header"
            onMouseDown={handleMouseDown}
            title="Hold and drag to move"
          >
            <h3><FaCalculator aria-hidden="true" /> Calculator</h3>
            <button 
              className="desktop-inline-calculator-close"
              onClick={() => setShowCalculator(false)}
              onMouseDown={(e) => e.stopPropagation()} // Prevent drag on click close
            >
              <FaTimes />
            </button>
          </div>
          <Calculator 
            importValue={calculatorImportValue}
            importToken={calculatorImportToken}
            onStateChange={onCalculatorStateChange}
          />
        </div>
      )}
    </div>
  );
}
