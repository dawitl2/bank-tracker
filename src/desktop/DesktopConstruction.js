import { useState, useEffect, useCallback } from "react";
import { 
  FaBuilding, 
  FaHome, 
  FaBolt, 
  FaPlug, 
  FaLightbulb, 
  FaLayerGroup, 
  FaThLarge, 
  FaPaintRoller, 
  FaSink, 
  FaToilet, 
  FaShower, 
  FaTools, 
  FaHammer, 
  FaBroom, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaLock 
} from "react-icons/fa";
import "./DesktopStyles.css";

const SUPABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation"
};

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: sbHeaders,
    ...options
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

const CONSTRUCTION_SECTIONS = [
  {
    label: "Foundation",
    items: [
      { id: "building_block", label: "Building block / structure", locked: true, icon: FaBuilding }
    ]
  },
  {
    label: "Shell",
    items: [
      { id: "roofing", label: "Roofing", icon: FaHome },
      { id: "exterior_doors", label: "Exterior doors", icon: FaBuilding },
      { id: "windows", label: "Windows", icon: FaThLarge }
    ]
  },
  {
    label: "Electrical",
    items: [
      { id: "electrical_rough", label: "Electrical wiring & conduits", icon: FaBolt },
      { id: "electrical_fixtures", label: "Electrical outlets & switches", icon: FaPlug },
      { id: "lighting", label: "Light fixtures & fittings", icon: FaLightbulb }
    ]
  },
  {
    label: "Interior",
    items: [
      { id: "gypsum", label: "Gypsum board (drywall)", icon: FaLayerGroup },
      { id: "ceiling", label: "Ceiling", icon: FaLayerGroup },
      { id: "ceramic_tiles_floor", label: "Ceramic floor tiles", icon: FaThLarge },
      { id: "interior_doors", label: "Interior doors", icon: FaHome },
      { id: "paint", label: "Paint (interior)", icon: FaPaintRoller }
    ]
  },
  {
    label: "Bathroom",
    items: [
      { id: "bathroom_sink", label: "Bathroom sink", icon: FaSink },
      { id: "bathroom_wc", label: "WC / toilet", icon: FaToilet },
      { id: "bathroom_shower", label: "Shower", icon: FaShower },
      { id: "bathroom_wall_tiles", label: "Bathroom wall tiles", icon: FaThLarge },
      { id: "bathroom_floor_tiles", label: "Bathroom floor tiles", icon: FaThLarge },
      { id: "bathroom_accessories", label: "Bathroom accessories", icon: FaTools }
    ]
  },
  {
    label: "Kitchen",
    items: [
      { id: "kitchen_sink", label: "Kitchen sink", icon: FaSink },
      { id: "kitchen_wall_tiles", label: "Kitchen wall tiles", icon: FaThLarge },
      { id: "kitchen_floor_tiles", label: "Kitchen floor tiles", icon: FaThLarge },
      { id: "kitchen_cabinets", label: "Kitchen cabinets & countertops", icon: FaHammer }
    ]
  },
  {
    label: "Final",
    items: [
      { id: "final_clean", label: "Final clean & snag list", icon: FaBroom }
    ]
  }
];

const ALL_ITEMS = CONSTRUCTION_SECTIONS.flatMap(s => s.items);
const TOTAL_ITEMS = ALL_ITEMS.length;

const formatWithCommas = (raw) => {
  let cleaned = raw.toString().replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  const [intPart, decPart] = cleaned.split(".");
  if (!intPart && decPart === undefined) return "";
  const formattedInt = (intPart || "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart !== undefined ? `${formattedInt || "0"}.${decPart}` : formattedInt;
};

export default function DesktopConstruction() {
  const [houses, setHouses] = useState([]);
  const [checkedByHouse, setCheckedByHouse] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedHouse, setSelectedHouse] = useState(null);
  
  // Custom dialog flags
  const [showHouseModal, setShowHouseModal] = useState(false);
  const [isEditingHouse, setIsEditingHouse] = useState(false);
  const [houseForm, setHouseForm] = useState({ id: null, name: "" });

  const [moneySpentInput, setMoneySpentInput] = useState("");
  const [dbSaving, setDbSaving] = useState(false);

  const loadHouses = useCallback(async () => {
    setLoading(true);
    try {
      const houseData = await sbFetch("/construction_houses?select=*&order=created_at.asc");
      setHouses(houseData);

      const checklist = await sbFetch("/construction_checklist?select=*");
      const map = {};
      houseData.forEach(h => { map[h.id] = { building_block: true }; });
      checklist.forEach(row => {
        if (!map[row.house_id]) map[row.house_id] = { building_block: true };
        map[row.house_id][row.item_id] = row.checked;
      });
      setCheckedByHouse(map);
      
      // Keep track of routed house selection locally
      if (houseData.length > 0 && !selectedHouse) {
        // default none
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedHouse]);

  useEffect(() => { loadHouses(); }, [loadHouses]);

  useEffect(() => {
    if (!selectedHouse) {
      setMoneySpentInput("");
      return;
    }
    setMoneySpentInput(selectedHouse.money_spent ? formatWithCommas(String(selectedHouse.money_spent)) : "");
  }, [selectedHouse]);

  const toggleItem = async (houseId, itemId) => {
    const current = checkedByHouse[houseId]?.[itemId] ?? false;
    const next = !current;
    setCheckedByHouse(prev => ({
      ...prev,
      [houseId]: { ...prev[houseId], [itemId]: next }
    }));
    try {
      await sbFetch(
        "/construction_checklist?on_conflict=house_id,item_id",
        {
          method: "POST",
          body: JSON.stringify({
            house_id: houseId,
            item_id: itemId,
            checked: next,
            updated_at: new Date().toISOString()
          }),
          headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=representation" }
        }
      );
    } catch (e) {
      setCheckedByHouse(prev => ({
        ...prev,
        [houseId]: { ...prev[houseId], [itemId]: current }
      }));
    }
  };

  const handleHouseSubmit = async () => {
    if (!houseForm.name.trim()) return;

    setDbSaving(true);
    try {
      if (isEditingHouse) {
        // Edit House
        await sbFetch(`/construction_houses?id=eq.${houseForm.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: houseForm.name.trim() })
        });
        setHouses(prev => prev.map(h => h.id === houseForm.id ? { ...h, name: houseForm.name.trim() } : h));
        if (selectedHouse?.id === houseForm.id) {
          setSelectedHouse(prev => ({ ...prev, name: houseForm.name.trim() }));
        }
      } else {
        // Add House
        const result = await sbFetch("/construction_houses", {
          method: "POST",
          body: JSON.stringify({ name: houseForm.name.trim() })
        });
        const newHouse = Array.isArray(result) ? result[0] : result;
        setSelectedHouse(newHouse);
        await loadHouses();
      }
      setShowHouseModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setDbSaving(false);
    }
  };

  const handleDeleteHouse = async (house) => {
    if (!window.confirm(`Delete ${house.name} and all checklist plans?`)) return;

    setDbSaving(true);
    try {
      await sbFetch(`/construction_houses?id=eq.${house.id}`, { method: "DELETE" });
      setSelectedHouse(null);
      await loadHouses();
    } catch (e) {
      console.error(e);
    } finally {
      setDbSaving(false);
    }
  };

  const updateMoneySpent = async (houseId, rawValue) => {
    const cleaned = rawValue.toString().replace(/[^\d.-]/g, "");
    const value = parseFloat(cleaned);
    const next = Number.isFinite(value) ? value : 0;
    
    setDbSaving(true);
    try {
      await sbFetch(`/construction_houses?id=eq.${houseId}`, {
        method: "PATCH",
        body: JSON.stringify({ money_spent: next })
      });
      setHouses(prev => prev.map(h => h.id === houseId ? { ...h, money_spent: next } : h));
      if (selectedHouse?.id === houseId) {
        setSelectedHouse(prev => ({ ...prev, money_spent: next }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDbSaving(false);
    }
  };

  const getHouseProgress = (houseId) => {
    const map = checkedByHouse[houseId] || {};
    const checked = ALL_ITEMS.filter(it => map[it.id]).length;
    const pct = Math.round((checked / TOTAL_ITEMS) * 100) || 0;
    return { checked, total: TOTAL_ITEMS, pct };
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <div className="spinner"></div>
        <span style={{ marginLeft: "12px", color: "var(--desktop-dark-muted)" }}>Loading construction projects...</span>
      </div>
    );
  }

  return (
    <div className="desktop-main-content" style={{ padding: 0, height: "auto" }}>
      {/* Redesigned section header */}
      <div className="desktop-section-header">
        <div>
          <h1>Construction Tracker</h1>
          <p style={{ margin: "4px 0 0", color: "var(--desktop-dark-muted)", fontSize: "14px" }}>
            Monitor checklist stages and expenditures.
          </p>
        </div>
        <button 
          className="desktop-pill active"
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--desktop-dark)", border: "none", color: "#ffffff" }}
          onClick={() => {
            setIsEditingHouse(false);
            setHouseForm({ id: null, name: "" });
            setShowHouseModal(true);
          }}
        >
          <FaPlus /> Add New Project
        </button>
      </div>

      {/* Legacy mobile styling wrapper class for construction layout consistency */}
      <div className="balance-page" style={{ padding: 0, gap: 0 }}>
        
        {/* Houses selection list - visible when no house is selected */}
        {!selectedHouse && (
          <article className="construction-card" style={{ margin: 0, width: "100%" }}>
            <div className="construction-heading">
              <span>Construction projects</span>
              <strong>{houses.length} projects active</strong>
            </div>
            <div className="desktop-large-construction-grid">
              {houses.map((house) => {
                const prog = getHouseProgress(house.id);
                return (
                  <div
                    key={house.id}
                    className="desktop-large-construction-card"
                    onClick={() => setSelectedHouse(house)}
                  >
                    <div className="desktop-large-construction-card-header">
                      <div className="desktop-large-construction-card-icon"><FaHome /></div>
                      <span className="desktop-large-construction-card-prog-lbl">{prog.pct}% Complete</span>
                    </div>
                    
                    <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <h3 className="desktop-large-construction-card-title">{house.name}</h3>
                      <div style={{ fontSize: "13px", color: "var(--desktop-dark-muted)", marginTop: "8px" }}>
                        Money spent: <strong>ETB {house.money_spent ? formatWithCommas(String(house.money_spent)) : "0"}</strong>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", marginTop: "4px" }}>
                        Tasks: <strong>{prog.checked} / {prog.total} completed</strong>
                      </div>
                    </div>

                    {/* Progress Fill Indicator */}
                    <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "3px", overflow: "hidden", marginTop: "16px" }}>
                      <div style={{ width: `${prog.pct}%`, height: "100%", background: "var(--desktop-accent)", transition: "width 0.3s ease" }} />
                    </div>

                    {/* Hover edit/delete actions */}
                    <div style={{ position: "absolute", top: "24px", right: "24px", display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                      <button 
                        className="desktop-table-action-btn" 
                        style={{ padding: "4px" }}
                        onClick={() => {
                          setIsEditingHouse(true);
                          setHouseForm({ id: house.id, name: house.name });
                          setShowHouseModal(true);
                        }}
                        title="Rename Project"
                      >
                        <FaEdit size={12} />
                      </button>
                      <button 
                        className="desktop-table-action-btn danger" 
                        style={{ padding: "4px" }}
                        onClick={() => handleDeleteHouse(house)}
                        title="Delete Project"
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        )}

        {/* Selected House Detail View: Splits side-by-side on desktop */}
        {selectedHouse && (
          <section className="construction-detail-page" style={{ width: "100%", padding: 0 }}>
            <div className="construction-page-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <button
                className="construction-back-btn"
                type="button"
                onClick={() => setSelectedHouse(null)}
                style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                ← Back to Projects
              </button>
            </div>

            <div className="construction-detail-header" style={{ marginBottom: "20px" }}>
              <div className="construction-detail-title-row">
                <span className="construction-detail-house-icon"><FaHome /></span>
                <span className="construction-detail-title">
                  <small>Construction project</small>
                  <strong>{selectedHouse.name}</strong>
                </span>
              </div>
              <div className="construction-detail-actions" style={{ display: "flex", gap: "8px" }}>
                <button
                  className="construction-detail-edit-btn"
                  type="button"
                  onClick={() => {
                    setIsEditingHouse(true);
                    setHouseForm({ id: selectedHouse.id, name: selectedHouse.name });
                    setShowHouseModal(true);
                  }}
                  title="Rename project"
                >
                  <FaEdit />
                </button>
                <button
                  className="construction-detail-delete-btn"
                  type="button"
                  onClick={() => handleDeleteHouse(selectedHouse)}
                  title="Delete project"
                >
                  <FaTrash />
                </button>
              </div>
            </div>

            <div className="construction-detail-body">
              {/* Left Column: Metrics & Budget */}
              <aside className="construction-project-overview">
                <div className="construction-overall-prog">
                  <div className="construction-overall-heading">
                    <span>Overall progress</span>
                    <strong>{getHouseProgress(selectedHouse.id).pct}%</strong>
                  </div>
                  <div className="construction-overall-bg">
                    <div className="construction-overall-fill" style={{ width: `${getHouseProgress(selectedHouse.id).pct}%` }} />
                  </div>
                  <div className="construction-overall-label">
                    {getHouseProgress(selectedHouse.id).checked} of {TOTAL_ITEMS} tasks completed
                  </div>
                </div>

                <div className="construction-money-spent">
                  <span className="construction-money-spent-label">Money spent</span>
                  <div className="construction-money-spent-row">
                    <span className="construction-money-spent-currency">ETB</span>
                    <input
                      className="construction-money-spent-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={moneySpentInput}
                      onChange={(e) => setMoneySpentInput(formatWithCommas(e.target.value))}
                      onBlur={() => updateMoneySpent(selectedHouse.id, moneySpentInput)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      disabled={dbSaving}
                    />
                  </div>
                </div>
              </aside>

              {/* Right Column: Legible mobile checklist representation */}
              <main className="construction-checklist-content">
                <div className="construction-checklist-heading">
                  <span>Project checklist</span>
                  <strong>{TOTAL_ITEMS - getHouseProgress(selectedHouse.id).checked} remaining</strong>
                </div>

                {CONSTRUCTION_SECTIONS.map((section) => {
                  const checked = checkedByHouse[selectedHouse.id] || { building_block: true };
                  
                  return (
                    <div key={section.label} className="construction-section">
                      <div className="construction-section-label">{section.label}</div>
                      {section.items.map((item) => {
                        const isChecked = !!checked[item.id];
                        const isLocked = !!item.locked;
                        const ItemIcon = item.icon || FaTools;
                        
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`construction-item-row${isLocked ? " locked" : ""}`}
                            onClick={() => !isLocked && toggleItem(selectedHouse.id, item.id)}
                            disabled={isLocked}
                            style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span className="construction-item-icon"><ItemIcon /></span>
                              <span className="construction-item-label">{item.label}</span>
                            </span>
                            <div className={`construction-checkbox${isChecked ? " checked" : ""}`}>
                              {isChecked && <FaPlus style={{ transform: "rotate(45deg)", fontSize: "10px" }} />}
                              {!isChecked && isLocked && <FaLock style={{ fontSize: "10px" }} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </main>
            </div>
          </section>
        )}
      </div>

      {/* Add / Edit House Modal */}
      {showHouseModal && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>{isEditingHouse ? "Rename Project" : "Add Construction Project"}</h2>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Project Name</label>
              <input 
                type="text"
                placeholder="e.g. Villa A, House 2..."
                value={houseForm.name}
                onChange={(e) => setHouseForm({ ...houseForm, name: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowHouseModal(false)} style={{ background: "rgba(0,0,0,0.05)", color: "var(--desktop-dark)" }}>Cancel</button>
              <button onClick={handleHouseSubmit} disabled={dbSaving}>{dbSaving ? "Saving..." : "Save Project"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
