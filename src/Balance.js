import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  FaArrowLeft,
  FaBolt,
  FaBorderAll,
  FaBroom,
  FaBuilding,
  FaCheck,
  FaDoorOpen,
  FaEye,
  FaEyeSlash,
  FaHammer,
  FaHome,
  FaLayerGroup,
  FaLightbulb,
  FaLock,
  FaPaintRoller,
  FaPen,
  FaPlug,
  FaPlus,
  FaShower,
  FaSink,
  FaThLarge,
  FaTimes,
  FaToilet,
  FaTools,
  FaTrashAlt
} from "react-icons/fa";
import Construction3D from "./Construction3D";
import Users from "./Users";

const SUPABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const ANALYTICS_CONFIG = {
  velocityWindowDays: 7,
  annualInterestRate: 0.07,
  interestTaxRate: 0.05,
  personGroups: [
    {
      key: "construction",
      label: "Construction",
      color: "#f4a300",
      match: (person) => person === "mihret" || person === "asnake" || person === "null"
    },
    {
      key: "yiss",
      label: "Yiss",
      color: "#20231f",
      match: (person) => person === "yiss"
    },
    {
      key: "enku",
      label: "Enku",
      color: "#b87200",
      match: (person) => person === "enku"
    },
    {
      key: "dawit",
      label: "Dawit",
      color: "#c73939",
      match: (person) => person === "dawit"
    },
    {
      key: "other",
      label: "Other",
      color: "#6f7d87",
      match: () => true
    }
  ]
};

const VISIBILITY_PASSWORD = "pass";

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
      { id: "exterior_doors", label: "Exterior doors", icon: FaDoorOpen },
      { id: "windows", label: "Windows", icon: FaBorderAll }
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
      { id: "interior_doors", label: "Interior doors", icon: FaDoorOpen },
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

const money = (value) => Math.round(value || 0).toLocaleString("en-US");
const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;

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

const formatSmsMoney = (value) => {
  const parsed = parseAmount(value);
  return parsed ? money(parsed) : "0.0";
};

const formatSmsDate = (value) => {
  if (!value) return "No BOA SMS yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Updated from BOA SMS";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const parseTxDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  const bankDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);
  if (bankDate) {
    const day = Number(bankDate[1]);
    const month = Number(bankDate[2]) - 1;
    const rawYear = Number(bankDate[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const hour = Number(bankDate[4] || 0);
    const minute = Number(bankDate[5] || 0);
    return new Date(year, month, day, hour, minute);
  }
  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const monthKey = (date) =>
  date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "Unknown";

const monthLabel = (key) => {
  if (key === "Unknown") return "Unknown";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
};

const fullMonthLabel = (key) => {
  if (key === "Unknown") return "Unknown month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const getPerson = (tx) =>
  tx.person === null || tx.person === undefined || tx.person === "" ? "null" : String(tx.person).toLowerCase();

const getGroup = (tx) => {
  const person = getPerson(tx);
  return ANALYTICS_CONFIG.personGroups.find((group) => group.match(person));
};

const getMonthBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

function getProgress(checkedMap) {
  const checked = ALL_ITEMS.filter(it => checkedMap[it.id]).length;
  return { checked, total: TOTAL_ITEMS, pct: Math.round((checked / TOTAL_ITEMS) * 100) };
}

function ConstructionPanel({ currentPath = "", navigate = () => {} }) {
  const [houses, setHouses] = useState([]);
  const [checkedByHouse, setCheckedByHouse] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [moneySpentInput, setMoneySpentInput] = useState("");
  const [moneySpentSaving, setMoneySpentSaving] = useState(false);
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [visualizingHouse, setVisualizingHouse] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const loadHouses = useCallback(async () => {
    setLoading(true);
    setError(null);
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
    } catch (e) {
      setError("Could not load construction data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHouses(); }, [loadHouses]);

  useEffect(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const houseId = parts[0] === "balance" && parts[1] === "construction" && parts[2]
      ? decodeURIComponent(parts[2])
      : null;

    if (!houseId) {
      setSelectedHouse(null);
      return;
    }

    const routedHouse = houses.find(house => String(house.id) === houseId);
    if (routedHouse) setSelectedHouse(routedHouse);
  }, [currentPath, houses]);

  useEffect(() => {
    if (!selectedHouse) {
      setMoneySpentInput("");
      return;
    }
    setMoneySpentInput(selectedHouse.money_spent ? formatWithCommas(String(selectedHouse.money_spent)) : "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHouse?.id]);

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

  const addHouse = async () => {
    const name = nameInput.trim() || `House ${houses.length + 1}`;
    setSaving(true);
    try {
      const result = await sbFetch("/construction_houses", {
        method: "POST",
        body: JSON.stringify({ name })
      });
      const newHouse = Array.isArray(result) ? result[0] : result;
      setHouses(prev => [...prev, newHouse]);
      setCheckedByHouse(prev => ({ ...prev, [newHouse.id]: { building_block: true } }));
      setNameInput("");
      setModal(null);
    } catch (e) {
      setError("Could not add house.");
    } finally {
      setSaving(false);
    }
  };

  const renameHouse = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setSaving(true);
    try {
      await sbFetch(`/construction_houses?id=eq.${modal.house.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      setHouses(prev => prev.map(h => h.id === modal.house.id ? { ...h, name } : h));
      setModal(null);
      setNameInput("");
    } catch (e) {
      setError("Could not rename house.");
    } finally {
      setSaving(false);
    }
  };

  const updateMoneySpent = async (houseId, rawValue) => {
    const cleaned = rawValue.toString().replace(/[^\d.-]/g, "");
    const value = parseFloat(cleaned);
    const next = Number.isFinite(value) ? value : 0;
    const current = houses.find(h => h.id === houseId)?.money_spent ?? 0;

    if (next === Number(current)) return;

    setMoneySpentSaving(true);
    setHouses(prev => prev.map(h => h.id === houseId ? { ...h, money_spent: next } : h));

    try {
      await sbFetch(`/construction_houses?id=eq.${houseId}`, {
        method: "PATCH",
        body: JSON.stringify({ money_spent: next })
      });
    } catch (e) {
      setHouses(prev => prev.map(h => h.id === houseId ? { ...h, money_spent: current } : h));
      setError("Could not update money spent.");
    } finally {
      setMoneySpentSaving(false);
    }
  };

  const uploadHousePhoto = async (houseId, file) => {
    if (!file) return;

    setPhotoUploading(true);
    setError(null);

    const extension = (file.type.split("/")[1] || "jpg").toLowerCase();
    const path = `${houseId}.${extension}`;

    try {
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/construction-photos/${path}`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": file.type || "image/jpeg",
            "x-upsert": "true"
          },
          body: file
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(errText || "Upload failed");
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/construction-photos/${path}?t=${Date.now()}`;

      await sbFetch(`/construction_houses?id=eq.${houseId}`, {
        method: "PATCH",
        body: JSON.stringify({ image_url: publicUrl })
      });

      setHouses(prev => prev.map(h => h.id === houseId ? { ...h, image_url: publicUrl } : h));
    } catch (e) {
      setError("Could not upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeleteHouse = (house) => {
    setDeleteTarget(house);
  };

  const confirmDeleteHouse = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await sbFetch(`/construction_checklist?house_id=eq.${deleteTarget.id}`, { method: "DELETE" });
      await sbFetch(`/construction_houses?id=eq.${deleteTarget.id}`, { method: "DELETE" });
      setHouses(prev => prev.filter(h => h.id !== deleteTarget.id));
      setCheckedByHouse(prev => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
      if (selectedHouse?.id === deleteTarget.id) setSelectedHouse(null);
      setDeleteTarget(null);
    } catch (e) {
      setError("Could not delete house.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <article className="analytics-card focus-card construction-card">
        <span>Construction</span>
        <p style={{ marginTop: 12, color: "var(--color-text-secondary, #666)" }}>Loading...</p>
      </article>
    );
  }

  if (error) {
    return (
      <article className="analytics-card focus-card construction-card">
        <span>Construction</span>
        <p style={{ marginTop: 12, color: "#c73939" }}>{error}</p>
        <button className="construction-action-btn" onClick={loadHouses} style={{ marginTop: 10 }}>Retry</button>
      </article>
    );
  }

  return (
    <>
      {!selectedHouse && <article className="analytics-card focus-card construction-card">
        <span>Construction</span>
        <h2 style={{ marginBottom: 16 }}>Houses</h2>

        <div className="construction-houses-grid">
          {houses.map(house => {
            const checked = checkedByHouse[house.id] || { building_block: true };
            const prog = getProgress(checked);
            return (
              <button
                key={house.id}
                type="button"
                className="construction-house-card"
                onClick={() => navigate(`/balance/construction/${encodeURIComponent(house.id)}`)}
              >
                <div className="construction-house-icon"><FaHome /></div>
                <div className="construction-house-name-row">
                  <span className="construction-house-name">{house.name}</span>
                </div>
                <div className="construction-prog-bg">
                  <div className="construction-prog-fill" style={{ width: `${prog.pct}%` }} />
                </div>
                <div className="construction-prog-label">{prog.checked}/{prog.total} · {prog.pct}%</div>
              </button>
            );
          })}
          <button
            className="construction-add-house"
            onClick={() => { setNameInput(""); setModal({ type: "add" }); }}
          >
            <FaPlus /> Add house
          </button>
        </div>
      </article>}

      {selectedHouse && (
        <section className="construction-detail-page">
          <div className="construction-page-topbar">
            <button
              className="construction-back-btn"
              type="button"
              onClick={() => navigate("/balance/construction")}
            >
              <FaArrowLeft /> Back to Houses
            </button>
            <img src="/logo.png" alt="Bank Logo" />
          </div>

          {(() => {
            const checked = checkedByHouse[selectedHouse.id] || { building_block: true };
            const prog = getProgress(checked);
            return <>
            <div className="construction-detail-header">
              <div className="construction-detail-title-row">
                <span className="construction-detail-house-icon"><FaHome /></span>
                <span className="construction-detail-title">
                  <small>Construction project</small>
                  <strong>{selectedHouse.name}</strong>
                </span>
              </div>
              <div className="construction-detail-actions">
                <button
                  className="construction-detail-edit-btn"
                  type="button"
                  onClick={() => {
                    setNameInput(selectedHouse.name);
                    setModal({ type: "edit", house: selectedHouse });
                  }}
                  title="Edit name"
                  aria-label="Edit name"
                >
                  <FaPen />
                </button>
                <button
                  className="construction-detail-delete-btn"
                  type="button"
                  onClick={() => handleDeleteHouse(selectedHouse)}
                  title="Delete house"
                  aria-label="Delete house"
                >
                  <FaTrashAlt />
                </button>
              </div>
            </div>

            <div className="construction-detail-body">
              <aside className="construction-project-overview">
                  <div className="construction-photo-wrap">
                    {selectedHouse.image_url ? (
                      <img
                        src={selectedHouse.image_url}
                        alt={selectedHouse.name}
                        className="construction-photo-img"
                        onClick={() => setLightboxUrl(selectedHouse.image_url)}
                        style={{ cursor: "zoom-in" }}
                      />
                    ) : (
                      <div className="construction-photo-placeholder">No photo yet</div>
                    )}
                    {photoUploading && (
                      <div className="construction-photo-uploading">Uploading...</div>
                    )}
                    <button
                      className="construction-photo-replace-btn"
                      onClick={() => setPhotoPromptOpen(true)}
                      disabled={photoUploading}
                      type="button"
                    >
                      {selectedHouse.image_url ? "Replace photo" : "Add photo"}
                    </button>
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadHousePhoto(selectedHouse.id, file);
                      }}
                    />
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) uploadHousePhoto(selectedHouse.id, file);
                      }}
                    />
                  </div>

                  <div className="construction-overall-prog">
                    <div className="construction-overall-heading">
                      <span>Overall progress</span>
                      <strong>{prog.pct}%</strong>
                    </div>
                    <div className="construction-overall-bg">
                      <div className="construction-overall-fill" style={{ width: `${prog.pct}%` }} />
                    </div>
                    <div className="construction-overall-label">{prog.checked} of {prog.total} tasks completed</div>
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
                        onChange={e => setMoneySpentInput(formatWithCommas(e.target.value))}
                        onBlur={() => {
                          updateMoneySpent(selectedHouse.id, moneySpentInput);
                          setMoneySpentInput(current => current.replace(/\.$/, ""));
                        }}
                        onKeyDown={e => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        disabled={moneySpentSaving}
                      />
                    </div>
                  </div>
              </aside>

              <main className="construction-checklist-content">
                <div className="construction-checklist-heading">
                  <span>Project checklist</span>
                  <strong>{prog.total - prog.checked} remaining</strong>
                </div>
                  {CONSTRUCTION_SECTIONS.map(section => (
                    <div key={section.label} className="construction-section">
                      <div className="construction-section-label">{section.label}</div>
                      {section.items.map(item => {
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
                          >
                            <span className="construction-item-icon"><ItemIcon /></span>
                            <span className="construction-item-label">{item.label}</span>
                            <div className={`construction-checkbox${isChecked ? " checked" : ""}`}>
                              {isChecked ? <FaCheck /> : isLocked ? <FaLock /> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
              </main>
            </div>
            </>;
          })()}
        </section>
      )}

      {modal && (
        <div className="construction-overlay" onClick={() => setModal(null)}>
          <div className="construction-mini-modal" onClick={e => e.stopPropagation()}>
            <div className="construction-mini-title">
              {modal.type === "add" ? "Add house" : "Edit house"}
            </div>
            <input
              className="construction-mini-input"
              placeholder="House name..."
              value={nameInput}
              maxLength={40}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") modal.type === "add" ? addHouse() : renameHouse();
                if (e.key === "Escape") setModal(null);
              }}
              autoFocus
            />
            <div className="construction-mini-actions">
              <button className="construction-mini-cancel" onClick={() => setModal(null)} disabled={saving}>
                Cancel
              </button>
              <button
                className="construction-mini-confirm"
                onClick={modal.type === "add" ? addHouse : renameHouse}
                disabled={saving}
              >
                {saving ? "..." : modal.type === "add" ? "Add" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h2>Delete House?</h2>
            <p>
              This will remove {deleteTarget.name || "this house"} and its checklist from the database.
            </p>
            <div className="confirm-actions">
              <button
                className="close-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Close
              </button>
              <button
                className="delete-confirm-btn"
                onClick={confirmDeleteHouse}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {photoPromptOpen && (
        <div className="confirm-overlay" onClick={() => setPhotoPromptOpen(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <h2>Add Photo</h2>
            <p>Take a new picture or choose one from your gallery.</p>
            <div className="confirm-actions">
              <button
                className="close-btn"
                onClick={() => setPhotoPromptOpen(false)}
              >
                Cancel
              </button>
              <button
                className="construction-photo-source-btn"
                onClick={() => {
                  setPhotoPromptOpen(false);
                  galleryInputRef.current?.click();
                }}
              >
                Gallery
              </button>
              <button
                className="construction-photo-source-btn"
                onClick={() => {
                  setPhotoPromptOpen(false);
                  cameraInputRef.current?.click();
                }}
              >
                Camera
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="construction-lightbox" onClick={() => setLightboxUrl(null)}>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="construction-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {visualizingHouse && (
        <Construction3D
          house={visualizingHouse}
          onClose={() => setVisualizingHouse(null)}
        />
      )}
    </>
  );
}

function Balance({
  balance,
  boaSmsState,
  boaSmsSummary = [],
  boaSmsLoading = false,
  onRefreshBoaSmsState,
  transactions = [],
  currentPath,
  navigate,
  parkingPayments = [],
  suqePayments = [],
  fetchDbPayments,
  people = [],
  fetchPeople,
  openParkingModal
}) {
  const [activePanel, setActivePanel] = useState("summary");

  useEffect(() => {
    if (!currentPath) return;
    if (currentPath.startsWith("/balance/people")) {
      setActivePanel("people");
    } else {
      const parts = currentPath.split("/").filter(Boolean);
      if (parts[0] === "balance" && parts[1]) {
        setActivePanel(parts[1]);
      } else if (parts[0] === "balance") {
        setActivePanel("summary");
      }
    }
  }, [currentPath]);
  const getVisibilityDayKey = () => new Date().toISOString().slice(0, 10);
  const [showBalance, setShowBalance] = useState(false);
  const [showInterest, setShowInterest] = useState(
    () => localStorage.getItem("interest_visibility_day") === getVisibilityDayKey()
  );
  const [visibilityPromptOpen, setVisibilityPromptOpen] = useState(false);
  const [visibilityPassword, setVisibilityPassword] = useState("");
  const [visibilityError, setVisibilityError] = useState(false);
  const [apolloPromptOpen, setApolloPromptOpen] = useState(false);
  const [apolloPassword, setApolloPassword] = useState("");
  const [apolloError, setApolloError] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRailRef = useRef(null);
  const apolloPromptTimerRef = useRef(null);
  const [apolloUnlocked, setApolloUnlocked] = useState(
    () => localStorage.getItem("apollo_visibility_day") === getVisibilityDayKey()
  );

  useEffect(() => {
    if (isFlipped) onRefreshBoaSmsState?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped]);

  useEffect(() => () => window.clearTimeout(apolloPromptTimerRef.current), []);

  const analytics = useMemo(() => {
    const enriched = transactions.map((tx) => ({
      ...tx,
      parsedAmount: parseAmount(tx.amount),
      parsedDate: parseTxDate(tx.date) || parseTxDate(tx.created_at),
      group: getGroup(tx)
    }));

    const withdrawals = enriched.filter((tx) => tx.is_withdraw !== false);
    const deposits = enriched.filter((tx) => tx.is_withdraw === false);
    const byNewest = (a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0);

    const totalWithdraw = withdrawals.reduce((sum, tx) => sum + tx.parsedAmount, 0);
    const totalDeposit = deposits.reduce((sum, tx) => sum + tx.parsedAmount, 0);
    const lastWithdraw = [...withdrawals].sort(byNewest)[0];
    const lastDeposit = [...deposits].sort(byNewest)[0];

    const groupTotals = ANALYTICS_CONFIG.personGroups.map((group) => {
      const matches = withdrawals.filter((tx) => tx.group?.key === group.key);
      const amount = matches.reduce((sum, tx) => sum + tx.parsedAmount, 0);
      return { ...group, amount, count: matches.length, share: totalWithdraw ? (amount / totalWithdraw) * 100 : 0 };
    });

    const monthMap = new Map();
    enriched.forEach((tx) => {
      const key = monthKey(tx.parsedDate);
      if (!monthMap.has(key)) {
        monthMap.set(key, { key, month: monthLabel(key), Withdraw: 0, Deposit: 0, Net: 0, count: 0, people: new Set() });
      }
      const month = monthMap.get(key);
      const isDeposit = tx.is_withdraw === false;
      if (isDeposit) { month.Deposit += tx.parsedAmount; month.Net += tx.parsedAmount; }
      else { month.Withdraw += tx.parsedAmount; month.Net -= tx.parsedAmount; }
      month.count += 1;
      month.people.add(getPerson(tx));
    });

    const monthlyTrend = [...monthMap.values()]
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((month) => ({ ...month, peopleCount: month.people.size, people: undefined }));

    const cumulativeTrend = withdrawals
      .filter((tx) => tx.parsedDate)
      .sort((a, b) => a.parsedDate - b.parsedDate)
      .reduce((rows, tx, index) => {
        const previous = rows[rows.length - 1]?.Spend || 0;
        const shouldKeep = index % 2 === 0 || index === withdrawals.length - 1;
        if (shouldKeep) {
          rows.push({
            date: tx.parsedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            Spend: previous + tx.parsedAmount
          });
        } else if (rows.length) {
          rows[rows.length - 1].Spend += tx.parsedAmount;
        }
        return rows;
      }, []);

    const netMovement = enriched.reduce((sum, tx) => tx.is_withdraw === false ? sum + tx.parsedAmount : sum - tx.parsedAmount, 0);
    const openingBalance = balance - netMovement;
    const sortedLedger = [...enriched].filter((tx) => tx.parsedDate).sort((a, b) => a.parsedDate - b.parsedDate);
    const { start: monthStart, end: monthEnd } = getMonthBounds();
    let runningBalance = openingBalance;
    let monthMinimumBalance = openingBalance;
    let monthOpeningBalance = openingBalance;

    sortedLedger.forEach((tx) => {
      if (tx.parsedDate < monthStart) {
        runningBalance += tx.is_withdraw === false ? tx.parsedAmount : -tx.parsedAmount;
        monthOpeningBalance = runningBalance;
        monthMinimumBalance = runningBalance;
        return;
      }
      if (tx.parsedDate <= monthEnd) {
        runningBalance += tx.is_withdraw === false ? tx.parsedAmount : -tx.parsedAmount;
        monthMinimumBalance = Math.min(monthMinimumBalance, runningBalance);
      }
    });

    const today = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthDays = monthEnd.getDate();
    const elapsedDays = Math.min(monthDays, Math.max(1, Math.ceil((today.getTime() - monthStart.getTime()) / dayMs)));
    const remainingDays = Math.max(0, Math.ceil((monthEnd.getTime() - today.getTime()) / dayMs));
    const dailyInterestRate = ANALYTICS_CONFIG.annualInterestRate / 365;
    const grossMonthEstimate = monthMinimumBalance * dailyInterestRate * monthDays;
    const netMonthEstimate = grossMonthEstimate * (1 - ANALYTICS_CONFIG.interestTaxRate);
    const remainingEstimate = monthMinimumBalance * dailyInterestRate * Math.max(remainingDays, 0) * (1 - ANALYTICS_CONFIG.interestTaxRate);

    return {
      totalWithdraw, totalDeposit, lastWithdraw, lastDeposit, groupTotals, monthlyTrend, cumulativeTrend,
      interest: {
        monthLabel: fullMonthLabel(monthKey(monthStart)),
        annualRate: ANALYTICS_CONFIG.annualInterestRate,
        taxRate: ANALYTICS_CONFIG.interestTaxRate,
        monthOpeningBalance, minimumBalance: monthMinimumBalance,
        elapsedDays, remainingDays, monthDays,
        grossMonthEstimate, netMonthEstimate, remainingEstimate
      }
    };
  }, [balance, transactions]);
  const panelOptions = [
    { key: "summary", label: "Summary" },
    { key: "people", label: "People" },
    { key: "interest", label: "Interest" },
    { key: "construction", label: "Construction" }
  ];
  const smsRecentRows = boaSmsSummary.map((event, index) => ({
    key: `${event.sms_received_at || "sms"}-${index}`,
    label: event.transaction_type === "deposit" ? "Deposit" : "Withdraw",
    date: formatSmsDate(event.sms_received_at),
    amount: parseAmount(event.amount),
    balanceAfter: parseAmount(event.balance_after)
  }));
  const receiptSummaryRows = useMemo(() => {
    const rawRows = analytics.monthlyTrend.map((month) => ({
      ...month,
      monthLabel: fullMonthLabel(month.key),
      meta: `${month.peopleCount} people`
    }));

    return rawRows.map((m, idx) => {
      const prevMonth = rawRows[idx + 1];
      const chartWindowStart = Math.max(0, idx - 2);
      const chartWindowEnd = Math.min(rawRows.length, idx + 3);
      const chartRows = rawRows.slice(chartWindowStart, chartWindowEnd).reverse();
      const chartValues = chartRows.map((row) => row.Withdraw);
      const chartMin = Math.min(...chartValues);
      const chartMax = Math.max(...chartValues);
      const chartRange = chartMax - chartMin;
      const chartPoints = chartRows.map((row, pointIndex) => {
        const x = chartRows.length === 1 ? 34 : 4 + (pointIndex * 60) / (chartRows.length - 1);
        const y = chartRange === 0 ? 16 : 27 - ((row.Withdraw - chartMin) / chartRange) * 22;
        return { x, y, key: row.key, isCurrent: row.key === m.key };
      });
      const linePoints = chartPoints.length === 1
        ? `4,${chartPoints[0].y} 64,${chartPoints[0].y}`
        : chartPoints.map(({ x, y }) => `${x},${y}`).join(" ");
      const areaPoints = `4,29 ${linePoints} 64,29`;
      const currentPoint = chartPoints.find((point) => point.isCurrent) || chartPoints[chartPoints.length - 1];
      let trendClass = "neutral";
      let trendIcon = "";
      let displayVal = "—";
      let trendDescription = "No earlier month available for comparison";

      if (prevMonth) {
        const currentSpent = m.Withdraw;
        const prevSpent = prevMonth.Withdraw;

        if (prevSpent > 0) {
          const diff = currentSpent - prevSpent;
          const pct = Math.abs((diff / prevSpent) * 100).toFixed(0);

          if (diff < 0) {
            trendClass = "decrease";
            trendIcon = "↓";
            displayVal = `${pct}%`;
            trendDescription = `Spending decreased ${pct}% compared with ${prevMonth.monthLabel}`;
          } else if (diff > 0) {
            trendClass = "increase";
            trendIcon = "↑";
            displayVal = `${pct}%`;
            trendDescription = `Spending increased ${pct}% compared with ${prevMonth.monthLabel}`;
          } else {
            trendClass = "neutral";
            trendIcon = "•";
            displayVal = "0%";
            trendDescription = `Spending was unchanged from ${prevMonth.monthLabel}`;
          }
        } else if (currentSpent > 0) {
          trendClass = "increase";
          trendIcon = "↑";
          displayVal = "new";
          trendDescription = `Spending started after no withdrawals in ${prevMonth.monthLabel}`;
        } else {
          trendIcon = "•";
          displayVal = "0%";
          trendDescription = `Spending was unchanged from ${prevMonth.monthLabel}`;
        }
      } else {
        trendClass = "neutral";
        displayVal = "new";
      }

      return {
        ...m,
        trendClass,
        trendIcon,
        displayVal,
        trendDescription,
        linePoints,
        areaPoints,
        currentPoint,
        chartMonthCount: chartRows.length
      };
    });
  }, [analytics.monthlyTrend]);
  const hiddenCardMoney = "*****";
  const hiddenSkeleton = <span className="money-skeleton" aria-label="Hidden value"></span>;
  const isSmsNumberLoading = isFlipped && (boaSmsLoading || !boaSmsState);
  const apolloLocked = isFlipped && !apolloUnlocked;
  const displayedBalance = isFlipped
    ? (apolloLocked ? hiddenSkeleton : formatSmsMoney(boaSmsState?.current_balance))
    : money(balance);
  const displayedWithdraw = isFlipped
    ? (apolloLocked ? hiddenSkeleton : formatSmsMoney(boaSmsState?.latest_withdrawal_amount))
    : money(analytics.totalWithdraw);
  const balanceDetail = isFlipped ? (
    <>
      Latest deposit: {formatSmsMoney(boaSmsState?.latest_deposit_amount)}
      <br />{formatSmsDate(boaSmsState?.deposit_updated_at || boaSmsState?.updated_at)}
    </>
  ) : (
    <>
      Last deposit: {analytics.lastDeposit?.amount || "-"}
      <br />{analytics.lastDeposit?.date || "No deposit yet"}
    </>
  );
  const withdrawDetail = isFlipped ? (
    <>
      Source: BOA SMS
      <br />{formatSmsDate(boaSmsState?.withdrawal_updated_at || boaSmsState?.updated_at)}
    </>
  ) : (
    <>
      Last withdraw: {analytics.lastWithdraw?.amount || "-"}
      <br />{analytics.lastWithdraw?.date || "No withdraw yet"}
    </>
  );

  const requestVisibility = () => { setShowBalance(current => !current); };

  const requestApolloUnlock = () => {
    if (apolloUnlocked) return;
    setApolloPromptOpen(true);
  };

  const handleCardRailScroll = () => {
    const rail = cardRailRef.current;
    const firstCard = rail?.firstElementChild;
    if (!rail || !firstCard) return;

    const nextIsApollo = rail.scrollLeft > firstCard.clientWidth * 0.55;
    if (nextIsApollo === isFlipped) return;

    setIsFlipped(nextIsApollo);
    window.clearTimeout(apolloPromptTimerRef.current);
    if (nextIsApollo && !apolloUnlocked) {
      apolloPromptTimerRef.current = window.setTimeout(() => setApolloPromptOpen(true), 320);
    }
  };

  const unlockApollo = () => {
    if (apolloPassword === VISIBILITY_PASSWORD) {
      localStorage.setItem("apollo_visibility_day", getVisibilityDayKey());
      setApolloUnlocked(true);
      setApolloPromptOpen(false);
      setApolloPassword("");
      setApolloError(false);
      return;
    }
    setApolloError(true);
  };

  const requestInterestVisibility = () => {
    if (showInterest) { setShowInterest(false); return; }
    if (localStorage.getItem("interest_visibility_day") === getVisibilityDayKey()) { setShowInterest(true); return; }
    setVisibilityPromptOpen(true);
  };

  const unlockVisibility = () => {
    if (visibilityPassword === VISIBILITY_PASSWORD) {
      localStorage.setItem("interest_visibility_day", getVisibilityDayKey());
      setShowInterest(true);
      setVisibilityPromptOpen(false);
      setVisibilityPassword("");
      setVisibilityError(false);
      return;
    }
    setVisibilityError(true);
  };

  const isConstructionDetailPage = currentPath.startsWith("/balance/construction/") &&
    currentPath.split("/").filter(Boolean).length > 2;

  if (isConstructionDetailPage) {
    return (
      <div className="construction-route-page">
        <ConstructionPanel currentPath={currentPath} navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="balance-page balance-dashboard">

      <section className="balance-hero">
        <div
          className="balance-card-rail"
          ref={cardRailRef}
          onScroll={handleCardRailScroll}
          aria-label="Bank accounts"
        >
          <div className="balance-card-slide">
            <img src="/card.png" className="card" alt="Main bank card" />
          </div>
          <div className="balance-card-slide">
            <img src="/card2.png" className="card" alt="Apollo bank card" />
          </div>
        </div>

        <div className="balance-grid">
          <div className="balance-stat deposit">
            <span className="balance-stat-label">{isFlipped ? "Apollo balance" : "Balance"}</span>
            <div className="balance-value-wrap">
              <h1 className={isSmsNumberLoading || apolloLocked ? "money-updating" : ""}>
                {isSmsNumberLoading ? "..." : apolloLocked ? hiddenSkeleton : showBalance ? displayedBalance : hiddenCardMoney}
              </h1>
              <button
                className="balance-visibility-btn"
                onClick={apolloLocked ? undefined : requestVisibility}
                type="button"
                style={apolloLocked ? { opacity: 0.3, pointerEvents: "none" } : {}}
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>{balanceDetail}</p>
            {apolloLocked && (
              <button className="account-lock-overlay" type="button" onClick={requestApolloUnlock}>
                <FaLock aria-hidden="true" />
                <strong>Apollo locked</strong>
                <small>Tap to unlock</small>
              </button>
            )}
          </div>

          <div className="divider"></div>

          <div className="balance-stat withdraw">
            <span className="balance-stat-label">{isFlipped ? "Apollo withdraw" : "Withdraw"}</span>
            <div className="balance-value-wrap">
              <h1 className={isSmsNumberLoading || apolloLocked ? "money-updating" : ""}>
                {isSmsNumberLoading ? "..." : apolloLocked ? hiddenSkeleton : showBalance ? displayedWithdraw : hiddenCardMoney}
              </h1>
              <button
                className="balance-visibility-btn"
                onClick={apolloLocked ? undefined : requestVisibility}
                type="button"
                style={apolloLocked ? { opacity: 0.3, pointerEvents: "none" } : {}}
              >
                {showBalance ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>{withdrawDetail}</p>
            {apolloLocked && (
              <button className="account-lock-overlay" type="button" onClick={requestApolloUnlock}>
                <FaLock aria-hidden="true" />
                <strong>Apollo locked</strong>
                <small>Tap to unlock</small>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="analytics-switcher" aria-label="Balance analytics">
        {panelOptions.map((option) => (
          <button
            key={option.key}
            className={activePanel === option.key ? "active" : ""}
            onClick={() => navigate(`/balance/${option.key}`)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </section>

      <section className="balance-panel-stage">

        {activePanel === "summary" && (
          <article className="analytics-card focus-card summary-card">
            <span>{isFlipped ? "BOA SMS" : "Month Summary"}</span>
            <h2>{isFlipped ? "Recent transactions" : "Recent months"}</h2>
            <div className="summary-list">
              {isFlipped && smsRecentRows.length === 0 && (
                <div className="summary-row">
                  <div><strong>No BOA SMS transactions yet</strong><small>Waiting for last-month sync</small></div>
                  <div><small>Amount</small><strong>{hiddenSkeleton}</strong></div>
                  <div><small>Balance</small><strong>{hiddenSkeleton}</strong></div>
                </div>
              )}
              {isFlipped && apolloLocked ? (
                [1, 2, 3].map((i) => (
                  <div className="summary-row" key={i}>
                    <div><strong>{hiddenSkeleton}</strong><small>{hiddenSkeleton}</small></div>
                    <div><small>Amount</small><strong>{hiddenSkeleton}</strong></div>
                    <div><small>Balance</small><strong>{hiddenSkeleton}</strong></div>
                  </div>
                ))
              ) : isFlipped ? (
                smsRecentRows.map((event) => (
                  <div className="summary-row" key={event.key}>
                    <div><strong>{event.label}</strong><small>{event.date}</small></div>
                    <div><small>Amount</small><strong>{money(event.amount)}</strong></div>
                    <div><small>Balance</small><strong>{event.balanceAfter ? money(event.balanceAfter) : "0.0"}</strong></div>
                  </div>
                ))
              ) : (
                receiptSummaryRows.map((m) => {
                  const gradientId = `trend-fill-${m.key.replace(/[^a-z0-9]/gi, "-")}`;

                  return (
                    <div className="summary-row" key={m.key}>
                      <div><strong>{m.monthLabel}</strong><small>{m.meta}</small></div>
                      <div><small>Withdraw</small><strong>{money(m.Withdraw)}</strong></div>
                      <div><small>Deposit</small><strong>{money(m.Deposit)}</strong></div>
                      <span
                        className={`trend-badge trend-${m.trendClass}`}
                        title={m.trendDescription}
                        aria-label={m.trendDescription}
                      >
                        <svg className="trend-mini-chart" viewBox="0 0 68 32" role="img" aria-hidden="true">
                          <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          <line className="trend-chart-guide" x1="3" y1="9" x2="65" y2="9" />
                          <line className="trend-chart-guide" x1="3" y1="23" x2="65" y2="23" />
                          <polygon points={m.areaPoints} fill={`url(#${gradientId})`} />
                          <polyline className="trend-chart-line" points={m.linePoints} />
                          <circle className="trend-chart-point-halo" cx={m.currentPoint.x} cy={m.currentPoint.y} r="3.6" />
                          <circle className="trend-chart-point" cx={m.currentPoint.x} cy={m.currentPoint.y} r="1.8" />
                        </svg>
                        <span className="trend-copy">
                          <small>{m.chartMonthCount}-month view</small>
                          <span>
                            <span className="trend-arrow">{m.trendIcon}</span>
                            <span className="trend-val">{m.displayVal}</span>
                          </span>
                        </span>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        )}

        {activePanel === "people" && (
          <Users
            transactions={transactions}
            currentPath={currentPath}
            navigate={navigate}
            parkingPayments={parkingPayments}
            suqePayments={suqePayments}
            fetchDbPayments={fetchDbPayments}
            people={people}
            fetchPeople={fetchPeople}
            openParkingModal={openParkingModal}
          />
        )}

        {activePanel === "interest" && (
          <article className={`analytics-card focus-card interest-card${showInterest ? "" : " is-locked"}`}>
            <span>Credit Interest</span>
            <div className="interest-lock-row">
              <h2 className={!showInterest ? "masked-interest-value" : ""}>{showInterest ? money(analytics.interest.netMonthEstimate) : hiddenCardMoney}</h2>
              <button className="interest-lock-btn" onClick={requestInterestVisibility} type="button">
                {showInterest ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>Based on the lowest balance reached in {analytics.interest.monthLabel} using the whole transaction table.</p>
            <div className="interest-grid">
              <div><small>Minimum balance</small><strong className={!showInterest ? "masked-interest-value" : ""}>{showInterest ? money(analytics.interest.minimumBalance) : hiddenCardMoney}</strong></div>
              <div><small>Remaining est.</small><strong className={!showInterest ? "masked-interest-value" : ""}>{showInterest ? money(analytics.interest.remainingEstimate) : hiddenCardMoney}</strong></div>
              <div><small>Remaining day</small><strong>{analytics.interest.remainingDays}</strong></div>
              <div><small>Interest days</small><strong>{analytics.interest.elapsedDays}/{analytics.interest.monthDays}</strong></div>
              <div><small>Annual rate</small><strong>{(analytics.interest.annualRate * 100).toFixed(1)}%</strong></div>
              <div><small>Deduction</small><strong>{(analytics.interest.taxRate * 100).toFixed(0)}%</strong></div>
            </div>
            {!showInterest && (
              <button className="interest-locked-overlay" type="button" onClick={requestInterestVisibility}>
                <FaLock aria-hidden="true" />
                <strong>Credit interest locked</strong>
                <small>Tap to unlock</small>
              </button>
            )}
          </article>
        )}



        {activePanel === "construction" && <ConstructionPanel currentPath={currentPath} navigate={navigate} />}

      </section>

      {visibilityPromptOpen && (
        <div className="password-overlay secure-password-overlay" role="dialog" aria-modal="true" aria-labelledby="interest-unlock-title">
          <div className="password-box">
            <button className="secure-password-close" type="button" aria-label="Close interest unlock" onClick={() => { setVisibilityPromptOpen(false); setVisibilityPassword(""); setVisibilityError(false); }}>
              <FaTimes aria-hidden="true" />
            </button>
            <div className="login-header">
              <img src="/logo.png" alt="Bank Logo" className="login-logo" />
              <h2 id="interest-unlock-title">Unlock Credit Interest</h2>
            </div>
            <div className="login-field">
              <label htmlFor="interest-password">Password</label>
              <input
                id="interest-password"
                type="password"
                placeholder="Password"
                value={visibilityPassword}
                onChange={(event) => { setVisibilityPassword(event.target.value); setVisibilityError(false); }}
                onKeyDown={(event) => { if (event.key === "Enter") unlockVisibility(); }}
                autoFocus
              />
            </div>
            {visibilityError && <div className="login-error-msg">Incorrect password</div>}
            <div className="secure-password-actions">
              <button className="login-cancel-btn" type="button" onClick={() => { setVisibilityPromptOpen(false); setVisibilityPassword(""); setVisibilityError(false); }}>Close</button>
              <button className="login-submit-btn" type="button" onClick={unlockVisibility}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      {apolloPromptOpen && (
        <div className="password-overlay secure-password-overlay" role="dialog" aria-modal="true" aria-labelledby="apollo-unlock-title">
          <div className="password-box">
            <button className="secure-password-close" type="button" aria-label="Close Apollo unlock" onClick={() => { setApolloPromptOpen(false); setApolloPassword(""); setApolloError(false); }}>
              <FaTimes aria-hidden="true" />
            </button>
            <div className="login-header">
              <img src="/logo.png" alt="Bank Logo" className="login-logo" />
              <h2 id="apollo-unlock-title">Unlock Apollo</h2>
            </div>
            <div className="login-field">
              <label htmlFor="apollo-password">Password</label>
              <input
                id="apollo-password"
                type="password"
                placeholder="Password"
                value={apolloPassword}
                onChange={(event) => { setApolloPassword(event.target.value); setApolloError(false); }}
                onKeyDown={(event) => { if (event.key === "Enter") unlockApollo(); }}
                autoFocus
              />
            </div>
            {apolloError && <div className="login-error-msg">Incorrect password</div>}
            <div className="secure-password-actions">
              <button className="login-cancel-btn" type="button" onClick={() => { setApolloPromptOpen(false); setApolloPassword(""); setApolloError(false); }}>Close</button>
              <button className="login-submit-btn" type="button" onClick={unlockApollo}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Balance;
