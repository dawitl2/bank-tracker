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
  FaCube 
} from "react-icons/fa";
import Construction3D from "../Construction3D";
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

const money = (value) => Math.round(value || 0).toLocaleString("en-US");

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
      
      // Auto-select first house if none selected
      if (houseData.length > 0 && !selectedHouse) {
        setSelectedHouse(houseData[0]);
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
      } else {
        // Add House
        const result = await sbFetch("/construction_houses", {
          method: "POST",
          body: JSON.stringify({ name: houseForm.name.trim() })
        });
        const newHouse = Array.isArray(result) ? result[0] : result;
        setSelectedHouse(newHouse);
      }
      await loadHouses();
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
      if (selectedHouse?.id === house.id) {
        setSelectedHouse(null);
      }
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
            Monitor checklist stages and visual blueprints side-by-side.
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

      {/* Houses selection ribbon */}
      <div className="desktop-pills" style={{ marginBottom: "8px" }}>
        {houses.map((house) => {
          const isSelected = selectedHouse?.id === house.id;
          const { pct } = getHouseProgress(house.id);

          return (
            <div 
              key={house.id} 
              className={`desktop-pill ${isSelected ? "active accent" : ""}`}
              style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "6px 14px" }}
              onClick={() => setSelectedHouse(house)}
            >
              <span style={{ fontWeight: 600 }}>{house.name} ({pct}%)</span>
              <div style={{ display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                <button 
                  className="desktop-table-action-btn" 
                  style={{ padding: "2px", color: isSelected ? "var(--desktop-dark)" : "inherit" }}
                  onClick={() => {
                    setIsEditingHouse(true);
                    setHouseForm({ id: house.id, name: house.name });
                    setShowHouseModal(true);
                  }}
                >
                  <FaEdit size={10} />
                </button>
                <button 
                  className="desktop-table-action-btn danger" 
                  style={{ padding: "2px", color: isSelected ? "#c73939" : "inherit" }}
                  onClick={() => handleDeleteHouse(house)}
                >
                  <FaTrash size={10} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedHouse ? (
        <div className="desktop-split-pane" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
          {/* Left Column: House metrics & checklist */}
          <div className="desktop-split-left">
            {/* Quick Metrics */}
            <div className="desktop-card" style={{ padding: "20px 24px" }}>
              <div className="desktop-grid-2">
                <div className="desktop-detail-block">
                  <label>Total Budget Spent</label>
                  <strong style={{ fontSize: "20px" }}>ETB {money(selectedHouse.money_spent)}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <input 
                      type="text"
                      className="desktop-search-input"
                      style={{ padding: "6px 10px", width: "130px", fontSize: "12px" }}
                      value={moneySpentInput}
                      placeholder="Update spent..."
                      onChange={(e) => setMoneySpentInput(formatWithCommas(e.target.value))}
                    />
                    <button 
                      className="desktop-pill active"
                      style={{ padding: "6px 12px", fontSize: "12px", border: "none" }}
                      onClick={() => updateMoneySpent(selectedHouse.id, moneySpentInput)}
                      disabled={dbSaving}
                    >
                      Update
                    </button>
                  </div>
                </div>
                <div className="desktop-detail-block" style={{ justifyContent: "center" }}>
                  <label>Checklist Progress</label>
                  <strong style={{ fontSize: "22px", color: "var(--desktop-accent)" }}>
                    {getHouseProgress(selectedHouse.id).pct}%
                  </strong>
                  <span style={{ fontSize: "12px" }}>
                    {getHouseProgress(selectedHouse.id).checked} of {TOTAL_ITEMS} items completed
                  </span>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="desktop-construction-checklist">
              {CONSTRUCTION_SECTIONS.map((sec) => (
                <div key={sec.label} className="desktop-checklist-section">
                  <div className="desktop-checklist-section-title">{sec.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                    {sec.items.map((it) => {
                      const isChecked = checkedByHouse[selectedHouse.id]?.[it.id] ?? false;
                      const Icon = it.icon;

                      return (
                        <div 
                          key={it.id}
                          className={`desktop-checklist-item ${isChecked ? "checked" : ""}`}
                          onClick={() => toggleItem(selectedHouse.id, it.id)}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}} // toggling handled on container click
                          />
                          <Icon style={{ color: isChecked ? "var(--desktop-dark-muted)" : "var(--desktop-accent)", minWidth: "14px" }} />
                          <span>{it.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Inline 3D Blueprint visualizer container */}
          <div className="desktop-split-right" style={{ height: "100%" }}>
            <div className="desktop-visualizer-container" style={{ width: "100%", height: "100%" }}>
              <Construction3D 
                house={selectedHouse}
                onClose={() => {}} // dummy inline close
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="desktop-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "450px", color: "var(--desktop-dark-muted)" }}>
          <FaCube size={52} style={{ color: "var(--desktop-border)", marginBottom: "16px" }} />
          <h3>No Construction Project Loaded</h3>
          <p style={{ margin: "4px 0 0", fontSize: "14px" }}>Create a new project using the "Add New Project" button above.</p>
        </div>
      )}

      {/* Add / Edit House Modal */}
      {showHouseModal && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>{isEditingHouse ? "Rename Project" : "Add Construction Project"}</h2>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Project / House Name</label>
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

      {/* Extra styles overriding Construction3D inside .desktop-visualizer-container */}
      <style>{`
        .desktop-visualizer-container .construction-3d-overlay {
          position: relative !important;
          inset: auto !important;
          z-index: 1 !important;
          background: transparent !important;
          padding: 0 !important;
          height: calc(100vh - 280px) !important;
          min-height: 520px !important;
          width: 100% !important;
        }
        .desktop-visualizer-container .construction-3d-panel {
          width: 100% !important;
          height: 100% !important;
          max-height: none !important;
          border-radius: 12px !important;
          box-shadow: var(--desktop-shadow-soft) !important;
          border: 1px solid var(--desktop-border) !important;
          background: #fbfcf8 !important;
        }
        .desktop-visualizer-container .construction-3d-close {
          display: none !important; /* hide fullscreen modal close */
        }
      `}</style>
    </div>
  );
}
