import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { FaEye, FaEyeSlash } from "react-icons/fa";

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
      { id: "building_block", label: "Building block / structure", locked: true }
    ]
  },
  {
    label: "Shell",
    items: [
      { id: "roofing", label: "Roofing" },
      { id: "exterior_doors", label: "Exterior doors" },
      { id: "windows", label: "Windows" }
    ]
  },
  {
    label: "Electrical",
    items: [
      { id: "electrical_rough", label: "Electrical wiring & conduits" },
      { id: "electrical_fixtures", label: "Electrical outlets & switches" },
      { id: "lighting", label: "Light fixtures & fittings" }
    ]
  },
  {
    label: "Interior",
    items: [
      { id: "gypsum", label: "Gypsum board (drywall)" },
      { id: "ceiling", label: "Ceiling" },
      { id: "ceramic_tiles_floor", label: "Ceramic floor tiles" },
      { id: "interior_doors", label: "Interior doors" },
      { id: "paint", label: "Paint (interior)" }
    ]
  },
  {
    label: "Bathroom",
    items: [
      { id: "bathroom_sink", label: "Bathroom sink" },
      { id: "bathroom_wc", label: "WC / toilet" },
      { id: "bathroom_shower", label: "Shower" },
      { id: "bathroom_wall_tiles", label: "Bathroom wall tiles" },
      { id: "bathroom_floor_tiles", label: "Bathroom floor tiles" },
      { id: "bathroom_accessories", label: "Bathroom accessories" }
    ]
  },
  {
    label: "Kitchen",
    items: [
      { id: "kitchen_sink", label: "Kitchen sink" },
      { id: "kitchen_wall_tiles", label: "Kitchen wall tiles" },
      { id: "kitchen_floor_tiles", label: "Kitchen floor tiles" },
      { id: "kitchen_cabinets", label: "Kitchen cabinets & countertops" }
    ]
  },
  {
    label: "Final",
    items: [
      { id: "final_clean", label: "Final clean & snag list" }
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

function ConstructionPanel() {
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
      <article className="analytics-card focus-card construction-card">
        <span>Construction</span>
        <h2 style={{ marginBottom: 16 }}>Houses</h2>

        <div className="construction-houses-grid">
          {houses.map(house => {
            const checked = checkedByHouse[house.id] || { building_block: true };
            const prog = getProgress(checked);
            return (
              <div
                key={house.id}
                className={`construction-house-card${selectedHouse?.id === house.id ? " selected" : ""}`}
                onClick={() => setSelectedHouse(house)}
              >
                <div className="construction-house-icon">🏠</div>
                <div className="construction-house-name-row">
                  <span className="construction-house-name">{house.name}</span>
                </div>
                <div className="construction-prog-bg">
                  <div className="construction-prog-fill" style={{ width: `${prog.pct}%` }} />
                </div>
                <div className="construction-prog-label">{prog.checked}/{prog.total} · {prog.pct}%</div>
              </div>
            );
          })}
          <button
            className="construction-add-house"
            onClick={() => { setNameInput(""); setModal({ type: "add" }); }}
          >
            + Add house
          </button>
        </div>
      </article>

      {selectedHouse && (
        <div className="construction-overlay" onClick={() => setSelectedHouse(null)}>
          <div className="construction-detail-modal" onClick={e => e.stopPropagation()}>

            {/* ── Header (never scrolls) ── */}
            <div className="construction-detail-header">
              <div className="construction-detail-title-row">
                <span className="construction-detail-title">🏠 {selectedHouse.name}</span>
                <button
                  className="construction-detail-edit-btn"
                  onClick={() => {
                    setNameInput(selectedHouse.name);
                    setModal({ type: "edit", house: selectedHouse });
                  }}
                  title="Edit name"
                  aria-label="Edit name"
                >
                  ✏️
                </button>
                <button
                  className="construction-detail-delete-btn"
                  onClick={() => handleDeleteHouse(selectedHouse)}
                  title="Delete house"
                  aria-label="Delete house"
                >
                  🗑️
                </button>
              </div>
              <button className="construction-close-btn" onClick={() => setSelectedHouse(null)}>✕</button>
            </div>

            {/* ── Everything below scrolls together ── */}
            {(() => {
              const checked = checkedByHouse[selectedHouse.id] || { building_block: true };
              const prog = getProgress(checked);
              return (
                <div className="construction-checklist-scroll">

                  {/* Photo */}
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

                  {/* Progress bar */}
                  <div className="construction-overall-prog">
                    <div className="construction-overall-bg">
                      <div className="construction-overall-fill" style={{ width: `${prog.pct}%` }} />
                    </div>
                    <div className="construction-overall-label">{prog.pct}% complete · {prog.checked} of {prog.total} done</div>
                  </div>

                  {/* Checklist sections */}
                  {CONSTRUCTION_SECTIONS.map(section => (
                    <div key={section.label} className="construction-section">
                      <div className="construction-section-label">{section.label}</div>
                      {section.items.map(item => {
                        const isChecked = !!checked[item.id];
                        const isLocked = !!item.locked;
                        return (
                          <div
                            key={item.id}
                            className={`construction-item-row${isLocked ? " locked" : ""}`}
                            onClick={() => !isLocked && toggleItem(selectedHouse.id, item.id)}
                          >
                            <div className={`construction-checkbox${isChecked ? " checked" : ""}`}>
                              {isChecked && "✓"}
                            </div>
                            <span className="construction-item-label">{item.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Money spent (at the bottom of the scroll) */}
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

                </div>
              );
            })()}

          </div>
        </div>
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
    </>
  );
}

function Balance({
  balance,
  boaSmsState,
  boaSmsSummary = [],
  boaSmsLoading = false,
  onRefreshBoaSmsState,
  transactions = []
}) {
  const [activePanel, setActivePanel] = useState("summary");
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
  const [apolloUnlocked, setApolloUnlocked] = useState(
    () => localStorage.getItem("apollo_visibility_day") === getVisibilityDayKey()
  );

  useEffect(() => {
    if (isFlipped) onRefreshBoaSmsState?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFlipped]);

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

  const strongestGroup = analytics.groupTotals.filter(g => g.amount > 0).sort((a, b) => b.amount - a.amount)[0] || analytics.groupTotals[0];
  const panelOptions = [
    { key: "summary", label: "Summary" },
    { key: "people", label: "People" },
    { key: "interest", label: "Interest" },
    { key: "charts", label: "Charts" },
    { key: "construction", label: "Construction" }
  ];
  const monthlyTrendAsc = [...analytics.monthlyTrend].sort((a, b) => a.key.localeCompare(b.key));
  const smsRecentRows = boaSmsSummary.map((event, index) => ({
    key: `${event.sms_received_at || "sms"}-${index}`,
    label: event.transaction_type === "deposit" ? "Deposit" : "Withdraw",
    date: formatSmsDate(event.sms_received_at),
    amount: parseAmount(event.amount),
    balanceAfter: parseAmount(event.balance_after)
  }));
  const receiptSummaryRows = analytics.monthlyTrend.map((month) => ({
    ...month, monthLabel: fullMonthLabel(month.key), meta: `${month.peopleCount} people`
  }));
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

  const requestApolloFlip = () => {
    if (isFlipped) { setIsFlipped(false); return; }
    setIsFlipped(true);
    if (localStorage.getItem("apollo_visibility_day") === getVisibilityDayKey()) return;
    setTimeout(() => { setApolloPromptOpen(true); }, 400);
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

  return (
    <div className="balance-page balance-dashboard">

      <section className="balance-hero">
        <div className={`card-3d-scene${isFlipped ? " is-flipped" : ""}`} onClick={requestApolloFlip}>
          <div className="card-3d-inner">
            <div className="card-3d-face card-3d-front">
              <img src="/card.png" className="card" alt="bank card front" />
            </div>
            <div className="card-3d-face card-3d-back">
              <img src="/card2.png" className="card" alt="bank card back" />
            </div>
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
          </div>
        </div>
      </section>

      <section className="analytics-switcher" aria-label="Balance analytics">
        {panelOptions.map((option) => (
          <button
            key={option.key}
            className={activePanel === option.key ? "active" : ""}
            onClick={() => setActivePanel(option.key)}
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
                receiptSummaryRows.map((m) => (
                  <div className="summary-row" key={m.key}>
                    <div><strong>{m.monthLabel}</strong><small>{m.meta}</small></div>
                    <div><small>Withdraw</small><strong>{money(m.Withdraw)}</strong></div>
                    <div><small>Deposit</small><strong>{money(m.Deposit)}</strong></div>
                  </div>
                ))
              )}
            </div>
          </article>
        )}

        {activePanel === "people" && (
          <article className="analytics-card focus-card">
            <span>People Involved</span>
            <h2>{strongestGroup.label}</h2>
            <p>{money(strongestGroup.amount)} is the largest spend lane.</p>
            <div className="people-list">
              {analytics.groupTotals.map((group) => (
                <div className="person-row" key={group.key}>
                  <div><strong>{group.label}</strong><small>{group.count} tx</small></div>
                  <div className="person-bar" aria-hidden="true">
                    <span style={{ width: `${group.share}%`, backgroundColor: group.color }}></span>
                  </div>
                  <b>{money(group.amount)}</b>
                </div>
              ))}
            </div>
          </article>
        )}

        {activePanel === "interest" && (
          <article className="analytics-card focus-card interest-card">
            <span>Credit Interest</span>
            <div className="interest-lock-row">
              <h2>{showInterest ? money(analytics.interest.netMonthEstimate) : hiddenSkeleton}</h2>
              <button className="interest-lock-btn" onClick={requestInterestVisibility} type="button">
                {showInterest ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            <p>Based on the lowest balance reached in {analytics.interest.monthLabel} using the whole transaction table.</p>
            <div className="interest-grid">
              <div><small>Minimum balance</small><strong>{showInterest ? money(analytics.interest.minimumBalance) : hiddenSkeleton}</strong></div>
              <div><small>Remaining est.</small><strong>{showInterest ? money(analytics.interest.remainingEstimate) : hiddenSkeleton}</strong></div>
              <div><small>Remaining day</small><strong>{analytics.interest.remainingDays}</strong></div>
              <div><small>Interest days</small><strong>{analytics.interest.elapsedDays}/{analytics.interest.monthDays}</strong></div>
              <div><small>Annual rate</small><strong>{(analytics.interest.annualRate * 100).toFixed(1)}%</strong></div>
              <div><small>Deduction</small><strong>{(analytics.interest.taxRate * 100).toFixed(0)}%</strong></div>
            </div>
          </article>
        )}

        {activePanel === "charts" && (
          <div className="analytics-layout">
            <article className="analytics-card analytics-card-wide">
              <div className="chart-heading">
                <div><span>Monthly Flow</span><h2>Withdraw, Deposit, Net</h2></div>
              </div>
              <div className="chart-panel">
                <ResponsiveContainer>
                  <BarChart data={monthlyTrendAsc}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" /><YAxis />
                    <Tooltip formatter={(value) => money(value)} /><Legend />
                    <Bar dataKey="Withdraw" fill="#f4a300" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Deposit" fill="#53a460" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Net" fill="#20231f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="analytics-card analytics-card-wide">
              <div className="chart-heading">
                <div><span>Spend Curve</span><h2>Cumulative Withdraw</h2></div>
              </div>
              <div className="chart-panel split-chart">
                <ResponsiveContainer>
                  <AreaChart data={analytics.cumulativeTrend}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f4a300" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#f4a300" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" /><YAxis />
                    <Tooltip formatter={(value) => money(value)} />
                    <Area type="monotone" dataKey="Spend" stroke="#f4a300" strokeWidth={3} fill="url(#spendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
                <ResponsiveContainer>
                  <LineChart data={monthlyTrendAsc}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" /><YAxis allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="peopleCount" name="People" stroke="#c73939" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        )}

        {activePanel === "construction" && <ConstructionPanel />}

      </section>

      {visibilityPromptOpen && (
        <div className="interest-password-overlay">
          <div className="interest-password-box">
            <h3>Unlock Visibility</h3>
            <input
              type="password"
              placeholder="Password"
              value={visibilityPassword}
              onChange={(event) => { setVisibilityPassword(event.target.value); setVisibilityError(false); }}
              onKeyDown={(event) => { if (event.key === "Enter") unlockVisibility(); }}
            />
            {visibilityError && <p style={{ color: "red", marginBottom: "12px" }}>Incorrect password</p>}
            <div className="interest-password-actions">
              <button type="button" onClick={() => { setVisibilityPromptOpen(false); setVisibilityPassword(""); setVisibilityError(false); }}>Close</button>
              <button type="button" onClick={unlockVisibility}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      {apolloPromptOpen && (
        <div className="interest-password-overlay">
          <div className="interest-password-box">
            <h3>Unlock Apollo</h3>
            <input
              type="password"
              placeholder="Password"
              value={apolloPassword}
              onChange={(event) => { setApolloPassword(event.target.value); setApolloError(false); }}
              onKeyDown={(event) => { if (event.key === "Enter") unlockApollo(); }}
            />
            {apolloError && <p style={{ color: "red", marginBottom: "12px" }}>Incorrect password</p>}
            <div className="interest-password-actions">
              <button type="button" onClick={() => { setIsFlipped(false); setApolloPromptOpen(false); setApolloPassword(""); setApolloError(false); }}>Close</button>
              <button type="button" onClick={unlockApollo}>Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Balance;