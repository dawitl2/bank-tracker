import { useState, useMemo } from "react";
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { 
  FaUserPlus, 
  FaEdit, 
  FaTrash, 
  FaPlus, 
  FaChartPie, 
  FaChevronRight 
} from "react-icons/fa";
import "./DesktopStyles.css";

const SUPABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;
const money = (value) => Math.round(value || 0).toLocaleString("en-US");

const getCategory = (narrative) => {
  const text = (narrative || "").toLowerCase();
  if (/cement|block|sand|iron|paint|door|window|roof|gypsum|tile|wood|labor|work|worker|site|material|pipe|plumb|brick|stone/i.test(text)) {
    return "Construction";
  }
  if (/transfer|cbe|boa|mobile|sent|received|telebirr|payment/i.test(text)) {
    return "Transfers";
  }
  if (/bill|water|electricity|dstv|telecom|internet|phone|card|recharge/i.test(text)) {
    return "Utilities";
  }
  if (/atm|cash|withdraw|cheque/i.test(text)) {
    return "Cash Withdrawals";
  }
  if (/hotel|cafe|restaurant|food|lunch|dinner|grocery|groceries|supermarket|drink|snack/i.test(text)) {
    return "Food & Dining";
  }
  return "Miscellaneous";
};

const getCurrentDateTimeString = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const getAvatarClass = (id) => {
  const known = ["dawit", "mihret", "asnake", "yiss", "enku"];
  return known.includes(id) ? `avatar-${id}` : "avatar-other";
};

const parseTxDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return value;
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
  return isNaN(fallback.getTime()) ? null : fallback;
};

export default function DesktopPeople({
  transactions = [],
  currentPath,
  navigate,
  parkingPayments = [],
  suqePayments = [],
  fetchDbPayments,
  people = [],
  fetchPeople
}) {
  const [dbSaving, setDbSaving] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  // Modal forms management
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [personForm, setPersonForm] = useState({ id: "", name: "", role: "" });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ id: null, amount: "", date: "", reference: "", narrative: "" });

  // Sync state selection with URL path if any
  const routePersonId = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length > 2 && parts[0] === "balance" && parts[1] === "people") {
      return parts[2].toLowerCase();
    }
    return null;
  }, [currentPath]);

  const selectedUser = useMemo(() => {
    return people.find((p) => p.id === (routePersonId || selectedPersonId));
  }, [routePersonId, selectedPersonId, people]);

  // Compute Outflow share for the sidebar
  const { usersSummary, totalOutflowTracked } = useMemo(() => {
    let totalOutflowTracked = 0;
    const summary = people.map((user) => {
      const userTxs = transactions.filter(
        (tx) => (tx.person || "").toLowerCase() === user.id
      );

      let spent = 0;
      let received = 0;

      userTxs.forEach((tx) => {
        const amt = parseAmount(tx.amount);
        if (tx.is_withdraw === false) received += amt;
        else spent += amt;
      });

      if (user.id === "dawit") {
        parkingPayments.forEach((p) => { spent += parseAmount(p.amount); });
      } else if (user.id === "yiss") {
        suqePayments.forEach((s) => { spent += parseAmount(s.amount); });
      }

      totalOutflowTracked += spent;

      const txCount = userTxs.length +
        (user.id === "dawit" ? parkingPayments.length : user.id === "yiss" ? suqePayments.length : 0);

      return {
        ...user,
        spent,
        received,
        txCount
      };
    });

    return { usersSummary: summary, totalOutflowTracked };
  }, [transactions, parkingPayments, suqePayments, people]);

  // Compute specific user detailed metrics
  const detailsData = useMemo(() => {
    if (!selectedUser) return null;

    const userTxs = transactions.filter(
      (tx) => (tx.person || "").toLowerCase() === selectedUser.id
    );

    let totalSpent = 0;
    let totalReceived = 0;
    let maxSpent = 0;
    let maxSpentDate = "N/A";

    const categoryTotals = {
      "Construction": 0, "Transfers": 0, "Utilities": 0,
      "Cash Withdrawals": 0, "Food & Dining": 0, "Miscellaneous": 0,
      "Parking Payments": 0, "Suqe Payments": 0
    };
    
    const categoryCounts = {
      "Construction": 0, "Transfers": 0, "Utilities": 0,
      "Cash Withdrawals": 0, "Food & Dining": 0, "Miscellaneous": 0,
      "Parking Payments": 0, "Suqe Payments": 0
    };

    const monthlyDataMap = {};

    const customDbPayments = selectedUser.id === "dawit"
      ? parkingPayments.map(p => ({ ...p, is_withdraw: true, is_custom: true, category: "Parking Payments" }))
      : selectedUser.id === "yiss"
        ? suqePayments.map(s => ({ ...s, is_withdraw: true, is_custom: true, category: "Suqe Payments" }))
        : [];

    const combinedUserTxs = [
      ...userTxs.map(t => ({ ...t, is_custom: false, category: getCategory(t.narrative) })),
      ...customDbPayments
    ];

    const categorizedTxs = combinedUserTxs.map((tx) => {
      const amt = parseAmount(tx.amount);
      const cat = tx.category;

      if (tx.is_withdraw === false) {
        totalReceived += amt;
      } else {
        totalSpent += amt;
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        if (amt > maxSpent) {
          maxSpent = amt;
          maxSpentDate = tx.date || "N/A";
        }
      }

      const dateObj = parseTxDate(tx.date || tx.created_at);
      if (dateObj) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        const mLabel = dateObj.toLocaleString("en-US", { month: "short", year: "2-digit" });

        if (!monthlyDataMap[monthKey]) {
          monthlyDataMap[monthKey] = { key: monthKey, label: mLabel, Spent: 0, Received: 0 };
        }
        if (tx.is_withdraw === false) {
          monthlyDataMap[monthKey].Received += amt;
        } else {
          monthlyDataMap[monthKey].Spent += amt;
        }
      }

      return { ...tx, parsedAmount: amt };
    });

    const monthlyTrend = Object.values(monthlyDataMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        name: item.label,
        Spent: item.Spent,
        Received: item.Received
      }));

    const categoriesBreakdown = Object.keys(categoryTotals).map((catName) => {
      const amount = categoryTotals[catName];
      const count = categoryCounts[catName];
      const percent = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
      return { name: catName, value: amount, count, percent };
    })
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);

    const withdrawalsOnly = categorizedTxs.filter((tx) => tx.is_withdraw !== false);
    const avgTransaction = withdrawalsOnly.length > 0 ? totalSpent / withdrawalsOnly.length : 0;

    return {
      allTransactions: categorizedTxs,
      totalSpent,
      totalReceived,
      netFlow: totalReceived - totalSpent,
      avgTransaction,
      maxSpent,
      maxSpentDate,
      categories: categoriesBreakdown,
      monthlyTrend
    };
  }, [selectedUser, transactions, parkingPayments, suqePayments]);

  const selectPerson = (id) => {
    setSelectedPersonId(id);
    navigate(`/balance/people/${id}`);
  };

  // Add/Edit Person
  const openAddPersonModal = () => {
    setIsEditingPerson(false);
    setPersonForm({ id: "", name: "", role: "" });
    setShowPersonModal(true);
  };

  const openEditPersonModal = (person) => {
    setIsEditingPerson(true);
    setPersonForm({ id: person.id, name: person.name, role: person.role || "" });
    setShowPersonModal(true);
  };

  const handlePersonSubmit = async () => {
    if (!personForm.name || !personForm.role) {
      alert("Name and Role are required!");
      return;
    }

    setDbSaving(true);
    try {
      if (isEditingPerson) {
        // PATCH
        const res = await fetch(`${SUPABASE_URL}/rest/v1/people?id=eq.${personForm.id}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: personForm.name, role: personForm.role })
        });
        if (res.ok) await fetchPeople();
      } else {
        // POST
        const generatedId = personForm.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
        const payload = {
          id: generatedId,
          name: personForm.name,
          role: personForm.role,
          class: getAvatarClass(generatedId)
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/people`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) await fetchPeople();
      }
      setShowPersonModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setDbSaving(false);
    }
  };

  const handleDeletePerson = async (person) => {
    if (!window.confirm(`Are you sure you want to delete ${person.name}?`)) return;
    if (!window.confirm(`WARNING: All data connected with ${person.name} will be decoupled! Proceed?`)) return;

    setDbSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/people?id=eq.${person.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) {
        await fetchPeople();
        if (selectedUser?.id === person.id) {
          setSelectedPersonId(null);
          navigate("/balance/people");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbSaving(false);
    }
  };

  // Add/Edit Custom payments (Dawit Parking / Yiss Suqe)
  const openAddPayment = () => {
    setIsEditingPayment(false);
    setPaymentForm({ id: null, amount: "", date: getCurrentDateTimeString(), reference: "", narrative: "" });
    setShowPaymentModal(true);
  };

  const openEditPayment = (tx) => {
    setIsEditingPayment(true);
    setPaymentForm({
      id: tx.id,
      amount: tx.amount?.toString() || "",
      date: tx.date || "",
      reference: tx.reference || "",
      narrative: tx.narrative || ""
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    const table = selectedUser.id === "dawit" ? "parking" : selectedUser.id === "yiss" ? "suqe" : null;
    if (!table) return;

    if (!paymentForm.amount || !paymentForm.date) {
      alert("Amount and Date are required!");
      return;
    }

    setDbSaving(true);
    try {
      const payload = {
        amount: parseFloat(paymentForm.amount) || 0,
        date: paymentForm.date,
        reference: paymentForm.reference || "",
        narrative: paymentForm.narrative || "",
        person: selectedUser.id
      };

      let res;
      if (isEditingPayment) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${paymentForm.id}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        await fetchDbPayments();
        setShowPaymentModal(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbSaving(false);
    }
  };

  const handleDeletePayment = async (tx) => {
    const table = selectedUser.id === "dawit" ? "parking" : selectedUser.id === "yiss" ? "suqe" : null;
    if (!table || !window.confirm("Delete this custom payment?")) return;

    setDbSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${tx.id}`, {
        method: "DELETE",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      });
      if (res.ok) await fetchDbPayments();
    } catch (err) {
      console.error(err);
    } finally {
      setDbSaving(false);
    }
  };

  return (
    <div className="desktop-main-content" style={{ padding: 0, height: "auto" }}>
      {/* Page Header */}
      <div className="desktop-section-header">
        <div>
          <h1>People & Team Expenditures</h1>
          <p style={{ margin: "4px 0 0", color: "var(--desktop-dark-muted)", fontSize: "14px" }}>
            Track cash outflow contribution share and individual statements.
          </p>
        </div>
        <button 
          className="desktop-pill active"
          style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--desktop-dark)", border: "none", color: "#ffffff" }}
          onClick={openAddPersonModal}
        >
          <FaUserPlus /> Add Member
        </button>
      </div>

      {/* Main Split Layout */}
      <div className="desktop-split-pane">
        {/* Left Side Pane: Users List */}
        <div className="desktop-split-left">
          {usersSummary.map((user) => {
            const userPercent = totalOutflowTracked > 0 ? Math.round((user.spent / totalOutflowTracked) * 100) : 0;
            const isSelected = selectedUser?.id === user.id;

            return (
              <div 
                key={user.id}
                className={`desktop-card ${isSelected ? "active-person" : ""}`}
                style={{ 
                  cursor: "pointer",
                  padding: "16px 20px",
                  border: isSelected ? "2px solid var(--desktop-accent)" : "1px solid var(--desktop-border)",
                  backgroundColor: isSelected ? "rgba(244,163,0,0.02)" : "var(--desktop-surface-card)",
                  position: "relative"
                }}
                onClick={() => selectPerson(user.id)}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                  <div className={`avatar-placeholder ${getAvatarClass(user.id)}`} style={{ width: "40px", height: "40px", fontSize: "16px" }}>
                    {user.name.charAt(0)}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{user.name}</h3>
                    <span style={{ fontSize: "11px", color: "var(--desktop-dark-muted)", textTransform: "uppercase" }}>{user.role}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <strong style={{ fontSize: "14px" }}>{money(user.spent)} ETB</strong>
                    <span style={{ fontSize: "11px", color: "var(--desktop-dark-muted)" }}>{userPercent}% Share</span>
                  </div>
                  <FaChevronRight size={10} style={{ color: "var(--desktop-border)", marginLeft: "4px" }} />
                </div>
                
                {/* Visual Progress Bar */}
                <div className="category-progress-track" style={{ height: "4px", marginTop: "12px", background: "rgba(0,0,0,0.03)" }}>
                  <div 
                    className="category-progress-fill"
                    style={{ 
                      height: "100%",
                      width: `${userPercent}%`,
                      background: user.id === "dawit" ? "#c73939" : user.id === "mihret" ? "#f4a300" : user.id === "asnake" ? "#b87200" : user.id === "yiss" ? "#20231f" : user.id === "enku" ? "#8c52ff" : "#6f7d87"
                    }}
                  ></div>
                </div>

                {/* Edit & Delete Action Hover buttons */}
                <div style={{ position: "absolute", right: "20px", top: "12px", display: "flex", gap: "4px" }} onClick={e => e.stopPropagation()}>
                  <button className="desktop-table-action-btn" style={{ padding: "4px" }} onClick={() => openEditPersonModal(user)}>
                    <FaEdit size={10} />
                  </button>
                  <button className="desktop-table-action-btn danger" style={{ padding: "4px" }} onClick={() => handleDeletePerson(user)}>
                    <FaTrash size={10} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Side Pane: Details / Analytics stacked vertically */}
        <div className="desktop-split-right">
          {!selectedUser ? (
            /* Unselected State: Team summary charts */
            <div className="desktop-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", color: "var(--desktop-dark-muted)" }}>
              <FaChartPie size={48} style={{ color: "var(--desktop-border)", marginBottom: "16px" }} />
              <h3>Select a team member to review</h3>
              <p style={{ margin: "4px 0 0", fontSize: "14px" }}>Click on any person card in the list to inspect their statements & trends.</p>
            </div>
          ) : (
            /* Selected State: Profile details stacked vertically */
            <>
              {/* Profile Header */}
              <div className="desktop-card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div className={`avatar-placeholder ${getAvatarClass(selectedUser.id)}`} style={{ width: "56px", height: "56px", fontSize: "22px" }}>
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>{selectedUser.name}</h2>
                    <span className="desktop-badge" style={{ background: "rgba(244,163,0,0.12)", color: "#b87200", textTransform: "uppercase", fontSize: "10px", marginTop: "4px" }}>
                      {selectedUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Trend AreaChart - Full Width Card */}
              <div className="desktop-card" style={{ width: "100%", marginBottom: "16px" }}>
                <div className="desktop-card-title">Monthly Outflow Trend</div>
                <div style={{ height: "240px", marginTop: "10px" }}>
                  {detailsData.monthlyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detailsData.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="userSpendGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f4a300" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#f4a300" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                        <XAxis dataKey="name" stroke="#74796e" fontSize={10} tickLine={false} />
                        <YAxis stroke="#74796e" fontSize={10} tickLine={false} tickFormatter={(val) => money(val)} />
                        <Tooltip formatter={(value) => [`${money(value)} ETB`, "Spent"]} />
                        <Area type="monotone" dataKey="Spent" stroke="var(--desktop-accent)" strokeWidth={2} fill="url(#userSpendGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--desktop-dark-muted)", fontSize: "13px" }}>
                      No historical trend curves
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Full Width Spacious Ledger */}
              <div className="desktop-card" style={{ width: "100%" }}>
                <div className="desktop-card-title">
                  <span>Account Statement</span>
                  {(selectedUser.id === "dawit" || selectedUser.id === "yiss") && (
                    <button 
                      className="desktop-pill active" 
                      style={{ padding: "4px 10px", fontSize: "12px", border: "none" }}
                      onClick={openAddPayment}
                    >
                      <FaPlus size={10} /> Add Custom
                    </button>
                  )}
                </div>

                <div className="desktop-table-container" style={{ maxHeight: "350px", overflowY: "auto" }}>
                  <table className="desktop-table">
                    <thead>
                      <tr>
                        <th style={{ padding: "16px 20px" }}>Date</th>
                        <th style={{ padding: "16px 20px" }}>Amount</th>
                        <th style={{ padding: "16px 20px" }}>Narrative</th>
                        {(selectedUser.id === "dawit" || selectedUser.id === "yiss") && <th style={{ padding: "16px 20px" }}>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.allTransactions.map((tx) => (
                        <tr key={tx.id} style={{ opacity: tx.is_custom ? 0.95 : 1 }}>
                          <td style={{ fontSize: "13px", padding: "16px 20px", whiteSpace: "nowrap" }}>{tx.date || tx.created_at}</td>
                          <td style={{ fontSize: "13px", padding: "16px 20px", fontWeight: 700, color: tx.is_withdraw === false ? "var(--desktop-color-deposit)" : "inherit" }}>
                            ETB {tx.amount}
                          </td>
                          <td style={{ fontSize: "13px", padding: "16px 20px" }}>
                            {tx.is_custom && <span className="desktop-badge" style={{ padding: "2px 6px", fontSize: "9px", background: "rgba(0,0,0,0.06)", marginRight: "6px" }}>DB Custom</span>}
                            {tx.narrative}
                          </td>
                          {(selectedUser.id === "dawit" || selectedUser.id === "yiss") && (
                            <td style={{ padding: "16px 20px" }}>
                              {tx.is_custom ? (
                                <div style={{ display: "flex", gap: "4px" }}>
                                  <button className="desktop-table-action-btn" style={{ padding: "4px" }} onClick={() => openEditPayment(tx)}>
                                    <FaEdit size={11} />
                                  </button>
                                  <button className="desktop-table-action-btn danger" style={{ padding: "4px" }} onClick={() => handleDeletePayment(tx)}>
                                    <FaTrash size={11} />
                                  </button>
                                </div>
                              ) : (
                                <span style={{ color: "var(--desktop-border)" }}>—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                      {detailsData.allTransactions.length === 0 && (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center", color: "var(--desktop-dark-muted)", padding: "40px" }}>
                            No transactions recorded for this user.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Person Modal */}
      {showPersonModal && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>{isEditingPerson ? "Edit Profile" : "Add Team Member"}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Full Name</label>
                <input 
                  type="text"
                  placeholder="Enter name..."
                  value={personForm.name}
                  onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Role / Designation</label>
                <input 
                  type="text"
                  placeholder="e.g. Architect, Manager..."
                  value={personForm.role}
                  onChange={(e) => setPersonForm({ ...personForm, role: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowPersonModal(false)} style={{ background: "rgba(0,0,0,0.05)", color: "var(--desktop-dark)" }}>Cancel</button>
              <button onClick={handlePersonSubmit} disabled={dbSaving}>{dbSaving ? "Saving..." : "Save Member"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Payment Modal (Dave Parking / Yiss Suqe) */}
      {showPaymentModal && (
        <div className="password-overlay secure-password-overlay" style={{ display: "flex", zIndex: 1000 }}>
          <div className="desktop-password-box">
            <h2>{isEditingPayment ? "Edit Payment" : `Add Custom ${selectedUser.id === "dawit" ? "Parking" : "Suqe"} Payment`}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Amount (ETB)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Date / Time</label>
                <input 
                  type="text"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Reference no</label>
                <input 
                  type="text"
                  placeholder="e.g. reference or plate"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", color: "var(--desktop-dark-muted)", display: "block", marginBottom: "4px" }}>Narrative</label>
                <input 
                  type="text"
                  placeholder="e.g. location description"
                  value={paymentForm.narrative}
                  onChange={(e) => setPaymentForm({ ...paymentForm, narrative: e.target.value })}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--desktop-border)" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "rgba(0,0,0,0.05)", color: "var(--desktop-dark)" }}>Cancel</button>
              <button onClick={handlePaymentSubmit} disabled={dbSaving}>{dbSaving ? "Saving..." : "Save Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
