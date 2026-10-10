import { FiList, FiCreditCard, FiHome, FiSettings, FiPlus } from "react-icons/fi";

const tabs = [
  { view: "transactions", label: "Transactions", path: "/transactions", Icon: FiList },
  { view: "balance", label: "Balance", path: "/balance", Icon: FiCreditCard },
  { view: "construction", label: "Construction", path: "/balance/construction", Icon: FiHome },
  { view: "settings", label: "Settings", path: "/settings", Icon: FiSettings }
];

export default function MobileNavigation({ view, navigate, onAdd }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {tabs.map(({ view: tabView, label, path, Icon }, index) => (
        <button key={tabView} type="button" className={`mobile-nav-tab mobile-nav-slot-${index}${view === tabView ? " active" : ""}`}
          aria-current={view === tabView ? "page" : undefined} onClick={() => navigate(path)}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
      <button type="button" className="mobile-nav-add" aria-label="Add transaction" onClick={onAdd}>
        <FiPlus aria-hidden="true" />
      </button>
    </nav>
  );
}
