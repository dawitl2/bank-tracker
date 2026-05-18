import { useState, useEffect, useCallback } from "react";

const opSymbol = (op) =>
  ({ "+": "+", "-": "−", "*": "×", "/": "÷", "%": "%" }[op] || op);

function fmt(n) {
  if (isNaN(n) || !isFinite(n)) return "Error";
  return parseFloat(n.toPrecision(12)).toString();
}

function compute(a, b, op) {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "*") return a * b;
  if (op === "/") return b === 0 ? NaN : a / b;
  if (op === "%") return a % b;
  return b;
}

function formatDisplay(s) {
  if (s === "Error") return "Error";
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  if (s.endsWith(".")) return s;
  if (Math.abs(n) >= 1e12) return n.toExponential(4);
  const parts = s.split(".");
  parts[0] = parseInt(parts[0], 10).toLocaleString();
  return parts.join(".");
}

export default function Calculator() {
  const [current, setCurrent] = useState("0");
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [expr, setExpr] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [evaled, setEvaled] = useState(false);
  const [activeOp, setActiveOp] = useState(null);

  const fontSize =
    current.length > 9 ? "32px" : current.length > 6 ? "48px" : "64px";

  const digit = useCallback((d) => {
    if (current === "Error") { setCurrent(d); setExpr(""); return; }
    if (waiting || evaled) {
      setCurrent(d); setWaiting(false); setEvaled(false);
    } else {
      setCurrent((c) => (c === "0" ? d : c + d));
    }
  }, [current, waiting, evaled]);

  const dot = useCallback(() => {
    if (waiting) { setCurrent("0."); setWaiting(false); return; }
    setCurrent((c) => (c.includes(".") ? c : c + "."));
  }, [waiting]);

  const pressOp = useCallback((newOp) => {
    const cur = parseFloat(current);
    if (prev !== null && !waiting && !evaled) {
      const r = compute(prev, cur, op);
      const rs = fmt(r);
      setCurrent(rs); setPrev(parseFloat(rs));
      setExpr(fmt(parseFloat(rs)) + " " + opSymbol(newOp));
    } else {
      setPrev(cur);
      setExpr(fmt(cur) + " " + opSymbol(newOp));
    }
    setOp(newOp); setWaiting(true); setEvaled(false); setActiveOp(newOp);
  }, [current, prev, op, waiting, evaled]);

  const pressEquals = useCallback(() => {
    if (op === null || prev === null) return;
    const cur = parseFloat(current);
    const r = compute(prev, cur, op);
    setExpr(fmt(prev) + " " + opSymbol(op) + " " + fmt(cur) + " =");
    setCurrent(fmt(r)); setPrev(null); setOp(null);
    setEvaled(true); setWaiting(false); setActiveOp(null);
  }, [current, prev, op]);

  const pressAC = useCallback(() => {
    setCurrent("0"); setPrev(null); setOp(null); setExpr("");
    setWaiting(false); setEvaled(false); setActiveOp(null);
  }, []);

  const pressPercent = useCallback(() => {
    const n = parseFloat(current);
    setCurrent(prev !== null && op ? fmt(prev * n / 100) : fmt(n / 100));
  }, [current, prev, op]);

  const pressBackspace = useCallback(() => {
    if (waiting || evaled || current === "Error") {
      setCurrent("0"); setWaiting(false); return;
    }
    setCurrent((c) => (c.length > 1 ? c.slice(0, -1) : "0"));
  }, [waiting, evaled, current]);

  useEffect(() => {
    const h = (e) => {
      if (e.key >= "0" && e.key <= "9") digit(e.key);
      else if (e.key === ".") dot();
      else if (e.key === "+") pressOp("+");
      else if (e.key === "-") pressOp("-");
      else if (e.key === "*") pressOp("*");
      else if (e.key === "/") { e.preventDefault(); pressOp("/"); }
      else if (e.key === "%") pressPercent();
      else if (e.key === "Enter" || e.key === "=") pressEquals();
      else if (e.key === "Backspace") pressBackspace();
      else if (e.key === "Escape") pressAC();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [digit, dot, pressOp, pressPercent, pressEquals, pressBackspace, pressAC]);

  const buttons = [
    { label: "AC",  type: "func" },
    { label: "⌫",   type: "bksp" },
    { label: "%",   type: "func" },
    { label: "÷",   type: "op", op: "/" },
    { label: "7",   type: "num" }, { label: "8", type: "num" }, { label: "9", type: "num" },
    { label: "×",   type: "op", op: "*" },
    { label: "4",   type: "num" }, { label: "5", type: "num" }, { label: "6", type: "num" },
    { label: "−",   type: "op", op: "-" },
    { label: "1",   type: "num" }, { label: "2", type: "num" }, { label: "3", type: "num" },
    { label: "+",   type: "op", op: "+" },
    { label: "0",   type: "num zero" },
    { label: ".",   type: "num" },
    { label: "=",   type: "eq" },
  ];

  const handleBtn = (btn) => {
    if (btn.label === "AC") pressAC();
    else if (btn.label === "⌫") pressBackspace();
    else if (btn.label === "%") pressPercent();
    else if (btn.type === "op") pressOp(btn.op);
    else if (btn.label === "=") pressEquals();
    else if (btn.label === ".") dot();
    else digit(btn.label);
  };

  const btnBg = (btn) => {
    if (btn.type === "bksp") return "#ff4d4d";
    if (btn.type === "func") return "#a5a5a5";
    if (btn.type === "op") return activeOp === btn.op ? "#fff" : "#eeb833";
    if (btn.type === "eq") return "#eeb833";
    return "#fff";
  };

  const btnColor = (btn) => {
    if (btn.type === "num" || btn.type === "num zero") return "#000";
    if (btn.type === "op" && activeOp === btn.op) return "#eeb833";
    return "#fff";
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", background: "#f2f2f7", borderRadius: 24 }}>
      <div style={{ background: "#f2f2f7", borderRadius: 44, padding: "24px 16px 28px", width: 300, userSelect: "none" }}>
        <div style={{ padding: "0 8px 16px", textAlign: "right", minHeight: 90, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ fontSize: 17, color: "#8e8e93", minHeight: 24, wordBreak: "break-all", fontFamily: "-apple-system, sans-serif" }}>
            {expr}
          </div>
          <div style={{ fontSize, color: "#000", lineHeight: 1.05, fontWeight: 300, fontFamily: "-apple-system, sans-serif", wordBreak: "break-all", transition: "font-size 0.1s" }}>
            {formatDisplay(current)}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={() => handleBtn(btn)}
              style={{
                height: 68,
                borderRadius: btn.type.includes("zero") ? 34 : "50%",
                border: btn.type === "op" && activeOp === btn.op ? "2px solid #eeb833" : "none",
                cursor: "pointer",
                fontSize: btn.label === "⌫" ? 22 : 26,
                fontWeight: 400,
                fontFamily: "-apple-system, sans-serif",
                display: "flex",
                alignItems: "center",
                justifyContent: btn.type.includes("zero") ? "flex-start" : "center",
                paddingLeft: btn.type.includes("zero") ? 24 : 0,
                gridColumn: btn.type.includes("zero") ? "span 2" : undefined,
                background: btnBg(btn),
                color: btnColor(btn),
                transition: "filter 0.08s",
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}