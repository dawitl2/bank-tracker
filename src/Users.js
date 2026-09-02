import { useMemo, useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { FaArrowLeft, FaCamera, FaChevronRight } from "react-icons/fa";
import "./Users.css";

const SUPABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const parseAmount = (value) => parseFloat(value?.toString().replace(/[^\d.-]/g, "")) || 0;
const money = (value) => Math.round(value || 0).toLocaleString("en-US");

// Helper to parse dates from transactions
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

// Categorize transaction narrative
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

// Format current date/time to DD/MM/YYYY HH:MM
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

export default function Users({
  transactions,
  currentPath,
  navigate,
  parkingPayments = [],
  suqePayments = [],
  fetchDbPayments,
  people = [],
  fetchPeople,
  openParkingModal
}) {
  const [dbSaving, setDbSaving] = useState(false);
  const [subTab, setSubTab] = useState("transactions");
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Modals management
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [showEditPersonModal, setShowEditPersonModal] = useState(false);

  // Form states
  const [editPaymentTarget, setEditPaymentTarget] = useState(null);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    date: getCurrentDateTimeString(),
    reference: "",
    narrative: ""
  });

  const [newPerson, setNewPerson] = useState({
    name: "",
    role: ""
  });

  const [actionMenu, setActionMenu] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

  // Extract user details path (e.g. /balance/people/dawit)
  const selectedUserId = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    if (parts.length > 2 && parts[0] === "balance" && parts[1] === "people") {
      return parts[2].toLowerCase();
    }
    return null;
  }, [currentPath]);

  const selectedUser = useMemo(() => {
    return people.find((u) => u.id === selectedUserId);
  }, [selectedUserId, people]);

  // Auto Scroll to Top & Reset State on User Change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSubTab("transactions");
    setShowAddPaymentModal(false);
    setShowAddPersonModal(false);
    setShowEditPersonModal(false);
    setEditPaymentTarget(null);
    setActionMenu(null);
    setNewPayment({
      amount: "",
      date: getCurrentDateTimeString(),
      reference: "",
      narrative: ""
    });
    setNewPerson({
      name: "",
      role: ""
    });
  }, [selectedUserId]);

  // Floating Back to Top scroll listener
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Long-press gestures and context menu handlers
  const openActionMenu = (event, tx) => {
    event.preventDefault();
    const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY ?? 0;

    setActionMenu({
      type: "payment",
      tx,
      x: Math.min(clientX, window.innerWidth - 190),
      y: Math.min(clientY, window.innerHeight - 180)
    });
  };

  const openPersonActionMenu = (event, person) => {
    event.preventDefault();
    const clientX = event.clientX ?? event.changedTouches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.changedTouches?.[0]?.clientY ?? 0;

    setActionMenu({
      type: "person",
      person,
      x: Math.min(clientX, window.innerWidth - 190),
      y: Math.min(clientY, window.innerHeight - 180)
    });
  };

  const startLongPress = (event, tx) => {
    const timer = setTimeout(() => {
      openActionMenu(event, tx);
    }, 650);
    setLongPressTimer(timer);
  };

  const startPersonLongPress = (event, person) => {
    const timer = setTimeout(() => {
      openPersonActionMenu(event, person);
    }, 650);
    setLongPressTimer(timer);
  };

  const stopLongPress = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Mutate (Create / Update / Delete) custom payment directly to Supabase
  const handleAddPaymentSubmit = async () => {
    const targetTable = selectedUserId === "dawit" ? "parking" : selectedUserId === "yiss" ? "suqe" : null;
    if (!targetTable) return;

    if (!newPayment.amount || !newPayment.date) {
      alert("Please fill in the amount and date!");
      return;
    }

    setDbSaving(true);
    try {
      const payload = {
        amount: parseFloat(newPayment.amount) || 0,
        date: newPayment.date,
        reference: newPayment.reference || "",
        narrative: newPayment.narrative || "",
        person: selectedUserId
      };

      let res;
      if (editPaymentTarget) {
        res = await fetch(`${SUPABASE_URL}/rest/v1/${targetTable}?id=eq.${editPaymentTarget.id}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${SUPABASE_URL}/rest/v1/${targetTable}`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        await fetchDbPayments();
        setShowAddPaymentModal(false);
        setEditPaymentTarget(null);
        setNewPayment({
          amount: "",
          date: getCurrentDateTimeString(),
          reference: "",
          narrative: ""
        });
      } else {
        const errorText = await res.text();
        console.error("Save error:", errorText);
        alert("Failed to save payment to Supabase.");
      }
    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert("An error occurred during save.");
    } finally {
      setDbSaving(false);
    }
  };

  const handleEditClick = () => {
    if (actionMenu.type === "person") {
      const p = actionMenu.person;
      setNewPerson({ name: p.name, role: p.role || "" });
      setShowEditPersonModal(true);
      setActionMenu(null);
    } else {
      const tx = actionMenu.tx;
      setEditPaymentTarget(tx);
      setNewPayment({
        amount: tx.amount?.toString() || "",
        date: tx.date || "",
        reference: tx.reference || "",
        narrative: tx.narrative || ""
      });
      setShowAddPaymentModal(true);
      setActionMenu(null);
    }
  };

  const handleDeleteClick = async () => {
    if (actionMenu.type === "person") {
      const p = actionMenu.person;
      setActionMenu(null);

      // Confirmation 1
      const confirm1 = window.confirm(`Are you sure you want to delete ${p.name}?`);
      if (!confirm1) return;

      // Confirmation 2
      const confirm2 = window.confirm(`WARNING: This will permanently delete ${p.name} and decouple their tracked data. Are you ABSOLUTELY sure?`);
      if (!confirm2) return;

      setDbSaving(true);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/people?id=eq.${p.id}`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        });

        if (res.ok) {
          await fetchPeople();
        } else {
          alert("Failed to delete person from Supabase.");
        }
      } catch (err) {
        console.error("DELETE PERSON ERROR:", err);
        alert("An error occurred during delete.");
      } finally {
        setDbSaving(false);
      }
    } else {
      const tx = actionMenu.tx;
      const targetTable = selectedUserId === "dawit" ? "parking" : selectedUserId === "yiss" ? "suqe" : null;
      if (!targetTable) return;

      if (!window.confirm("Are you sure you want to delete this payment?")) {
        setActionMenu(null);
        return;
      }

      setDbSaving(true);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${targetTable}?id=eq.${tx.id}`, {
          method: "DELETE",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        });

        if (res.ok) {
          await fetchDbPayments();
          setActionMenu(null);
        } else {
          alert("Failed to delete payment from Supabase.");
        }
      } catch (err) {
        console.error("DELETE ERROR:", err);
        alert("An error occurred during delete.");
      } finally {
        setDbSaving(false);
      }
    }
  };

  // Add a new person in Supabase
  const handleAddPersonSubmit = async () => {
    if (!newPerson.name || !newPerson.role) {
      alert("Please fill in Name and Role!");
      return;
    }

    const generatedId = newPerson.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    if (!generatedId) {
      alert("Invalid Name!");
      return;
    }

    // Check if ID already exists
    if (people.some(p => p.id === generatedId)) {
      alert("A person with this name already exists!");
      return;
    }

    setDbSaving(true);
    try {
      const payload = {
        id: generatedId,
        name: newPerson.name,
        role: newPerson.role,
        class: getAvatarClass(generatedId)
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/people`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchPeople();
        setShowAddPersonModal(false);
        setNewPerson({ name: "", role: "" });
      } else {
        alert("Failed to add person to Supabase.");
      }
    } catch (err) {
      console.error("ADD PERSON ERROR:", err);
      alert("An error occurred while adding person.");
    } finally {
      setDbSaving(false);
    }
  };

  // Edit a person's profile details
  const handleEditPersonSubmit = async () => {
    if (!newPerson.name || !newPerson.role) {
      alert("Please fill in Name and Role!");
      return;
    }

    setDbSaving(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/people?id=eq.${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          name: newPerson.name,
          role: newPerson.role
        })
      });

      if (res.ok) {
        await fetchPeople();
        setShowEditPersonModal(false);
      } else {
        alert("Failed to update profile details in Supabase.");
      }
    } catch (err) {
      console.error("EDIT PERSON ERROR:", err);
      alert("An error occurred while updating profile.");
    } finally {
      setDbSaving(false);
    }
  };


  // Calculate global summary stats for each user (for the list view)
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
        if (tx.is_withdraw === false) {
          received += amt;
        } else {
          spent += amt;
        }
      });

      // Add database-backed custom payments to the spent sum
      if (user.id === "dawit") {
        parkingPayments.forEach((p) => {
          spent += parseAmount(p.amount);
        });
      } else if (user.id === "yiss") {
        suqePayments.forEach((s) => {
          spent += parseAmount(s.amount);
        });
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

    return {
      usersSummary: summary,
      totalOutflowTracked
    };
  }, [transactions, parkingPayments, suqePayments, people]);

  // Detailed user metrics & chart computations
  const detailsData = useMemo(() => {
    if (!selectedUser) return null;

    const userTxs = transactions.filter(
      (tx) => (tx.person || "").toLowerCase() === selectedUser.id
    );

    let totalSpent = 0;
    let totalReceived = 0;
    let maxSpent = 0;
    let maxSpentDate = "N/A";

    // Categories breakdown
    const categoryTotals = {
      "Construction": 0,
      "Transfers": 0,
      "Utilities": 0,
      "Cash Withdrawals": 0,
      "Food & Dining": 0,
      "Miscellaneous": 0,
      "Parking Payments": 0,
      "Suqe Payments": 0
    };
    const categoryCounts = {
      "Construction": 0,
      "Transfers": 0,
      "Utilities": 0,
      "Cash Withdrawals": 0,
      "Food & Dining": 0,
      "Miscellaneous": 0,
      "Parking Payments": 0,
      "Suqe Payments": 0
    };

    // Monthly trends
    const monthlyDataMap = {};

    // Map custom db payments to matching structures
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

      // Extract month for trend
      const dateObj = parseTxDate(tx.date);
      if (dateObj) {
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = dateObj.toLocaleString("en-US", { month: "short", year: "2-digit" });

        if (!monthlyDataMap[monthKey]) {
          monthlyDataMap[monthKey] = {
            key: monthKey,
            label: monthLabel,
            Spent: 0,
            Received: 0
          };
        }

        if (tx.is_withdraw === false) {
          monthlyDataMap[monthKey].Received += amt;
        } else {
          monthlyDataMap[monthKey].Spent += amt;
        }
      }

      return {
        ...tx,
        parsedAmount: amt
      };
    });

    // Format monthly trends chronologically
    const monthlyTrend = Object.values(monthlyDataMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((item) => ({
        name: item.label,
        Spent: item.Spent,
        Received: item.Received
      }));

    // Format categories for chart/list (excluding the ones with zero value)
    const categoriesBreakdown = Object.keys(categoryTotals).map((catName) => {
      const amount = categoryTotals[catName];
      const count = categoryCounts[catName];
      const percent = totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0;
      return {
        name: catName,
        value: amount,
        count,
        percent
      };
    })
    .filter((c) => c.value > 0 || c.count > 0)
    .sort((a, b) => b.value - a.value);

    // Calculate averages
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

  // Render main users list nested in Balance Tab
  if (!selectedUser) {
    return (
      <div className="users-container">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div className="analytics-card focus-card" style={{ flexGrow: 1, margin: 0 }}>
            <span>Spending Overview</span>
            <h2>Tracked Outflow Share</h2>
            <p>Analyzing total spending of <b>{money(totalOutflowTracked)} ETB</b> across team members.</p>
          </div>
        </div>

        <div className="users-grid">
          {usersSummary.map((user) => {
            const userPercent = totalOutflowTracked > 0 ? Math.round((user.spent / totalOutflowTracked) * 100) : 0;
            const avatarClass = getAvatarClass(user.id);

            return (
              <div
                key={user.id}
                className="user-card"
                onClick={() => navigate(`/balance/people/${user.id}`)}
                onContextMenu={(event) => openPersonActionMenu(event, user)}
                onTouchStart={(event) => startPersonLongPress(event, user)}
                onTouchEnd={stopLongPress}
                onTouchMove={stopLongPress}
                onTouchCancel={stopLongPress}
              >

                <div className={`avatar-placeholder ${avatarClass}`}>
                  {user.name.charAt(0)}
                </div>

                <div className="user-card-info">
                  <h3>{user.name}</h3>
                  <div className="user-role">{user.role}</div>
                </div>

                <div className="user-card-progress-wrapper" style={{ flexGrow: 1, width: "100%", margin: "10px 0 15px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#74796e", marginBottom: "4px" }}>
                    <span>Share of outflow</span>
                    <strong>{userPercent}%</strong>
                  </div>
                  <div className="category-progress-track">
                    <div
                      className="category-progress-fill"
                      style={{
                        width: `${userPercent}%`,
                        background: user.id === "dawit" ? "#c73939" : user.id === "mihret" ? "#f4a300" : user.id === "asnake" ? "#b87200" : user.id === "yiss" ? "#20231f" : user.id === "enku" ? "#8c52ff" : "#6f7d87"
                      }}
                    ></div>
                  </div>
                </div>

                <div className="user-card-stats">
                  <div className="user-card-stat">
                    <span>Spent</span>
                    <strong>{money(user.spent)}</strong>
                  </div>
                  <div className="user-card-stat">
                    <span>Tx Count</span>
                    <strong>{user.txCount}</strong>
                  </div>
                </div>

                <div className="user-card-arrow" aria-hidden="true">
                  <FaChevronRight />
                </div>
              </div>
            );
          })}
        </div>

        <div className="add-person-btn-container">
          <button
            className="back-btn"
            onClick={() => setShowAddPersonModal(true)}
            style={{ background: "#eeb833", borderColor: "#eeb833", color: "#000" }}
          >
            + Add Person
          </button>
        </div>

        {/* Modal for adding a person */}
        {showAddPersonModal && (
          <div className="modal-overlay" style={{ zIndex: 2000 }}>
            <div className="modal" style={{ maxWidth: "420px" }}>
              <h2>Add New Person</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
                <label className="draft-field">
                  <span>Name</span>
                  <input
                    type="text"
                    placeholder="Enter full name..."
                    value={newPerson.name}
                    onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                    disabled={dbSaving}
                    required
                  />
                </label>

                <label className="draft-field">
                  <span>Role</span>
                  <input
                    type="text"
                    placeholder="e.g. Project Coordinator"
                    value={newPerson.role}
                    onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
                    disabled={dbSaving}
                    required
                  />
                </label>
              </div>

              <div className="modal-buttons" style={{ marginTop: "28px" }}>
                <button
                  className="save-draft-btn"
                  onClick={handleAddPersonSubmit}
                  disabled={dbSaving}
                >
                  {dbSaving ? "Saving..." : "Add Person"}
                </button>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowAddPersonModal(false);
                    setNewPerson({ name: "", role: "" });
                  }}
                  disabled={dbSaving}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Scroll to Top button */}
        {showScrollTop && (
          <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Scroll to top">
            &uarr;
          </button>
        )}
      </div>
    );
  }

  // Render detailed user view (DEDICATED FULL-PAGE VIEW)
  const {
    allTransactions,
    totalSpent,
    totalReceived,
    netFlow,
    avgTransaction,
    maxSpent,
    maxSpentDate,
    categories,
    monthlyTrend
  } = detailsData;

  // Filter display transactions based on selected sub-tab toggle
  const displayTxs = allTransactions
    .filter((tx) => {
      if (subTab === "transactions") return !tx.is_custom;
      if (subTab === "parking") return tx.is_custom && tx.category === "Parking Payments";
      if (subTab === "suqe") return tx.is_custom && tx.category === "Suqe Payments";
      return true;
    })
    .map((tx, originalIndex) => ({ tx, originalIndex }))
    .sort((a, b) => {
      if (subTab !== "parking") return a.originalIndex - b.originalIndex;

      const aTime = (parseTxDate(a.tx.date) || parseTxDate(a.tx.created_at))?.getTime() || 0;
      const bTime = (parseTxDate(b.tx.date) || parseTxDate(b.tx.created_at))?.getTime() || 0;
      return bTime - aTime || a.originalIndex - b.originalIndex;
    })
    .map(({ tx }) => tx);

  const avatarClass = getAvatarClass(selectedUser.id);

  return (
    <div className="users-container">
      {/* Top Header Bar with Back Button & Mini Logo */}
      <div className="user-page-top-bar">
        <button className="back-btn" onClick={() => navigate("/balance/people")}>
          <FaArrowLeft /> Back to People
        </button>
        <img src="/logo.png" alt="Bank Logo" style={{ height: "32px", width: "auto" }} />
      </div>

      {/* User Profile Header Section */}
      <div className="user-detail-header" style={{ marginBottom: "30px" }}>
        <div className="user-profile-summary" style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap", gap: "15px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div className={`avatar-placeholder avatar-large ${avatarClass}`}>
              {selectedUser.name.charAt(0)}
            </div>
            <div className="user-profile-info">
              <h2>{selectedUser.name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                <span className="user-badge" style={{ background: "#eeb833", color: "#000", fontWeight: "700", fontSize: "11px", padding: "2px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
                  {selectedUser.role}
                </span>
                <span style={{ color: "#74796e", fontSize: "13px" }}>
                  &bull; {allTransactions.length} Total Payments Tracked
                </span>
              </div>
            </div>
          </div>
          <button
            className="back-btn"
            onClick={() => {
              setNewPerson({ name: selectedUser.name, role: selectedUser.role || "" });
              setShowEditPersonModal(true);
            }}
            style={{ fontSize: "13px", height: "fit-content", padding: "8px 16px" }}
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="detail-metrics-grid">
        <div className="metric-card spent-card">
          <span>Total Outflow</span>
          <strong>{money(totalSpent)} ETB</strong>
        </div>
        <div className="metric-card received-card">
          <span>Total Inflow</span>
          <strong>{money(totalReceived)} ETB</strong>
        </div>
        <div className="metric-card">
          <span>Net Balance</span>
          <strong style={{ color: netFlow >= 0 ? "#53a460" : "#c73939" }}>
            {netFlow >= 0 ? "+" : ""}{money(netFlow)} ETB
          </strong>
        </div>
        <div className="metric-card">
          <span>Avg. Ticket Size</span>
          <strong>{money(avgTransaction)} ETB</strong>
        </div>
      </div>

      {/* Charts & Category Breakdown Grid */}
      <div className="user-analytics-section">
        {/* Left Side: Trends and Charts */}
        <div className="user-charts-wrapper">
          <article className="analytics-card">
            <div className="chart-heading">
              <div>
                <span>Outflow History Curve</span>
                <h2>Monthly Spending Trend</h2>
              </div>
            </div>
            <div className="chart-panel" style={{ height: "240px", marginTop: "16px" }}>
              {monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="userSpendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f4a300" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#f4a300" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(24, 24, 22, 0.05)" />
                    <XAxis dataKey="name" stroke="#74796e" fontSize={11} tickLine={false} />
                    <YAxis stroke="#74796e" fontSize={11} tickLine={false} tickFormatter={(val) => money(val)} />
                    <Tooltip formatter={(value) => [`${money(value)} ETB`, "Spent"]} />
                    <Area type="monotone" dataKey="Spent" stroke="#f4a300" strokeWidth={3} fill="url(#userSpendGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#74796e", fontSize: "13px" }}>
                  No historical trend data available
                </div>
              )}
            </div>
          </article>

          <article className="analytics-card">
            <div className="chart-heading">
              <div>
                <span>Outflow Breakdown</span>
                <h2>Category Distribution</h2>
              </div>
            </div>
            <div className="chart-panel" style={{ height: "240px", marginTop: "16px" }}>
              {totalSpent > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categories.filter((c) => c.value > 0)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(24, 24, 22, 0.05)" />
                    <XAxis dataKey="name" stroke="#74796e" fontSize={10} tickLine={false} />
                    <YAxis stroke="#74796e" fontSize={11} tickLine={false} tickFormatter={(val) => money(val)} />
                    <Tooltip formatter={(value) => [`${money(value)} ETB`, "Spent"]} />
                    <Bar dataKey="value" name="Amount Spent" fill="#20231f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#74796e", fontSize: "13px" }}>
                  No spending categories data available
                </div>
              )}
            </div>
          </article>
        </div>

        {/* Right Side: Detailed Category Progress Lists */}
        <div className="categories-card">
          <h3>Spending Breakdown</h3>
          <div className="categories-list">
            {categories.map((cat) => (
              <div key={cat.name} style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px solid rgba(24, 24, 22, 0.04)", paddingBottom: "12px" }}>
                <div className="category-item">
                  <div className="category-info">
                    <span className="category-name">{cat.name}</span>
                    <span className="category-count">{cat.count} transactions</span>
                  </div>
                  <strong className="category-amount">{money(cat.value)} ETB</strong>
                </div>

                <div className="category-progress-track">
                  <div
                    className="category-progress-fill"
                    style={{
                      width: `${cat.percent}%`,
                      background: cat.name === "Construction" ? "#f4a300" : cat.name === "Parking Payments" ? "#c73939" : cat.name === "Suqe Payments" ? "#8c52ff" : "#20231f"
                    }}
                  ></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", fontSize: "10px", color: "#74796e" }}>
                  <span>{cat.percent}% of outflow</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "20px", paddingTop: "15px", borderTop: "1px solid rgba(24, 24, 22, 0.06)" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#74796e", fontWeight: "700" }}>
              Largest Single Expense
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
              <strong style={{ fontSize: "18px", fontWeight: "800", color: "#c73939" }}>
                {money(maxSpent)} ETB
              </strong>
              <small style={{ color: "#74796e", fontSize: "12px" }}>
                {maxSpentDate}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Choice Toggle Switcher for Dawit and Yiss */}
      {selectedUser.id === "dawit" && (
        <div className="sub-toggle-bar">
          <button className={subTab === "transactions" ? "active" : ""} onClick={() => setSubTab("transactions")}>
            Transactions History
          </button>
          <button className={subTab === "parking" ? "active" : ""} onClick={() => setSubTab("parking")}>
            Parking Payments
          </button>
        </div>
      )}

      {selectedUser.id === "yiss" && (
        <div className="sub-toggle-bar">
          <button className={subTab === "transactions" ? "active" : ""} onClick={() => setSubTab("transactions")}>
            Transactions History
          </button>
          <button className={subTab === "suqe" ? "active" : ""} onClick={() => setSubTab("suqe")}>
            Suqe Payments
          </button>
        </div>
      )}

      {/* Transactions List Table / Custom Table */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "25px", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#20231f", margin: 0 }}>
          {subTab === "transactions" ? "Transactions History" : selectedUser.id === "dawit" ? "Parking Payments" : "Suqe Payments"}
        </h2>
        {subTab !== "transactions" && (
          <button
            className="back-btn parking-add-entry"
            onClick={() => selectedUser.id === "dawit" ? openParkingModal() : setShowAddPaymentModal(true)}
            style={{ background: "#eeb833", borderColor: "#eeb833", color: "#000" }}
          >
            {selectedUser.id === "dawit" ? <><FaCamera /> Add Parking</> : "+ Add Payment"}
          </button>
        )}
      </div>

      {displayTxs.length > 0 ? (
        <table className="transaction-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Amount</th>
              <th>Date / Time</th>
              <th>
                {subTab === "transactions"
                  ? "Reference no"
                  : selectedUser.id === "dawit"
                    ? "Plate Number / Ref"
                    : "Shop / Grocery Name"
                }
              </th>
              <th>Narrative</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {displayTxs.map((tx, idx) => (
              <tr
                key={tx.id}
                className={tx.is_withdraw === false ? "deposit-row" : "transaction-row"}
                onContextMenu={(event) => subTab !== "transactions" && openActionMenu(event, tx)}
                onTouchStart={(event) => subTab !== "transactions" && startLongPress(event, tx)}
                onTouchEnd={stopLongPress}
                onTouchMove={stopLongPress}
                onTouchCancel={stopLongPress}
              >
                <td>{idx + 1}</td>
                <td className="amount">{subTab === "transactions" ? tx.amount : `${money(tx.amount)} ETB`}</td>
                <td className="date-cell">{tx.date}</td>
                <td>{tx.reference}</td>
                <td>
                  <span className={`user-inline-badge badge-${selectedUser.id}`} style={{ marginLeft: 0, marginRight: "8px" }}>
                    {tx.category}
                  </span>
                  {tx.narrative}
                </td>
                <td className="action">
                  {!tx.is_custom && tx.receipt_url ? (
                    <a href={tx.receipt_url} target="_blank" rel="noopener noreferrer">
                      View
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="analytics-card" style={{ textAlign: "center", padding: "40px", color: "#74796e" }}>
          {dbSaving ? "Processing..." : `No ${subTab === "transactions" ? "receipt transactions" : subTab === "parking" ? "parking payments" : "suqe payments"} registered`}
        </div>
      )}

      {/* Modal for adding/editing parking/suqe payments */}
      {showAddPaymentModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: "420px" }}>
            <h2>{editPaymentTarget ? "Edit" : "Add"} {selectedUser.id === "dawit" ? "Parking" : "Suqe"} Payment</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
              <label className="draft-field">
                <span>Amount (ETB)</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                  disabled={dbSaving}
                  required
                />
              </label>

              <label className="draft-field">
                <span>Date / Time</span>
                <input
                  type="text"
                  value={newPayment.date}
                  onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                  disabled={dbSaving}
                  required
                />
              </label>

              <label className="draft-field">
                <span>{selectedUser.id === "dawit" ? "Plate Number / Ref" : "Shop / Grocery Name"}</span>
                <input
                  type="text"
                  placeholder={selectedUser.id === "dawit" ? "e.g. Code 3 - AA 12345" : "e.g. Merkato Shop #2"}
                  value={newPayment.reference}
                  onChange={(e) => setNewPayment({ ...newPayment, reference: e.target.value })}
                  disabled={dbSaving}
                />
              </label>

              <label className="draft-field">
                <span>Narrative</span>
                <input
                  type="text"
                  placeholder="Payment description..."
                  value={newPayment.narrative}
                  onChange={(e) => setNewPayment({ ...newPayment, narrative: e.target.value })}
                  disabled={dbSaving}
                />
              </label>
            </div>

            <div className="modal-buttons" style={{ marginTop: "28px" }}>
              <button
                className="save-draft-btn"
                onClick={handleAddPaymentSubmit}
                disabled={dbSaving}
              >
                {dbSaving ? "Saving..." : editPaymentTarget ? "Save Changes" : "Save Payment"}
              </button>
              <button
                className="close-btn"
                onClick={() => {
                  setShowAddPaymentModal(false);
                  setEditPaymentTarget(null);
                }}
                disabled={dbSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for editing person details */}
      {showEditPersonModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: "420px" }}>
            <h2>Edit Profile Details</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "20px" }}>
              <label className="draft-field">
                <span>Name</span>
                <input
                  type="text"
                  placeholder="Enter name..."
                  value={newPerson.name}
                  onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                  disabled={dbSaving}
                  required
                />
              </label>

              <label className="draft-field">
                <span>Role</span>
                <input
                  type="text"
                  placeholder="Enter role..."
                  value={newPerson.role}
                  onChange={(e) => setNewPerson({ ...newPerson, role: e.target.value })}
                  disabled={dbSaving}
                  required
                />
              </label>
            </div>

            <div className="modal-buttons" style={{ marginTop: "28px" }}>
              <button
                className="save-draft-btn"
                onClick={handleEditPersonSubmit}
                disabled={dbSaving}
              >
                {dbSaving ? "Saving..." : "Save Changes"}
              </button>
              <button
                className="close-btn"
                onClick={() => {
                  setShowEditPersonModal(false);
                  setNewPerson({ name: "", role: "" });
                }}
                disabled={dbSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Menu (Edit / Delete / Close) */}
      {actionMenu && (
        <div
          className="row-action-backdrop"
          onClick={() => setActionMenu(null)}
        >
          <div
            className="row-action-menu"
            style={{
              left: actionMenu.x,
              top: actionMenu.y
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button onClick={handleEditClick}>
              Edit
            </button>

            <button
              className="danger"
              onClick={handleDeleteClick}
            >
              Delete
            </button>

            <button onClick={() => setActionMenu(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Floating Scroll to Top button */}
      {showScrollTop && (
        <button className="scroll-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Scroll to top">
          &uarr;
        </button>
      )}
    </div>
  );
}
