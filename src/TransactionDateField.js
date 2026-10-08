import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaCalendarAlt, FaTimes } from "react-icons/fa";
import "./TransactionDateField.css";

const MONTHS = Array.from({ length: 12 }, (_, month) => new Date(2024, month, 1).toLocaleString("en", { month: "long" }));
const ROW_HEIGHT = 44;
const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const pad = value => String(value).padStart(2, "0");
export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();
const today = () => {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
};

export function parseTransactionDate(value) {
  const text = String(value ?? "");
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  const local = text.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})(.*)$/);
  const date = iso ? { year: +iso[1], month: +iso[2], day: +iso[3] }
    : local ? { day: +local[1], month: +local[3], year: +local[4] + (local[4].length === 2 ? 2000 : 0) } : null;
  if (!date || date.year < 1900 || date.month < 1 || date.month > 12 || date.day < 1 || date.day > daysInMonth(date.year, date.month)) return today();
  return date;
}

export function replaceTransactionDate(value, date) {
  const text = String(value ?? "");
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (iso) return `${date.year}-${pad(date.month)}-${pad(date.day)}${iso[4]}`;
  const local = text.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})(.*)$/);
  const separator = local?.[2] || "/";
  const year = local?.[4].length === 2 && date.year >= 2000 && date.year <= 2099 ? pad(date.year % 100) : String(date.year);
  return `${pad(date.day)}${separator}${pad(date.month)}${separator}${year}${local?.[5] || ""}`;
}

function DateWheel({ label, values, value, onChange, format = String }) {
  const wheelRef = useRef(null);
  const initializedRef = useRef(false);
  const programmaticRef = useRef(null);
  const [highlight, setHighlight] = useState(value);
  const start = values[0];
  const end = values[values.length - 1];

  useLayoutEffect(() => {
    const wheel = wheelRef.current;
    const top = (value - start) * ROW_HEIGHT;
    setHighlight(value);
    // Let touch momentum and native scroll snapping finish uninterrupted.
    // External changes (Today, keyboard, tapping a row) glide into position.
    if (!initializedRef.current || start + Math.round(wheel.scrollTop / ROW_HEIGHT) !== value) {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      programmaticRef.current = value;
      if (wheel.scrollTo) wheel.scrollTo({ top, behavior: initializedRef.current && !reducedMotion ? "smooth" : "instant" });
      else wheel.scrollTop = top;
    }
    initializedRef.current = true;
  }, [value, start, end]);

  const choose = next => {
    const bounded = Math.max(start, Math.min(end, next));
    onChange(bounded);
  };

  return <div className="transaction-date-column">
    <span className="transaction-date-column-label">{label}</span>
    <div className="transaction-date-wheel" ref={wheelRef} role="spinbutton" tabIndex={0}
      aria-label={label} aria-valuemin={start} aria-valuemax={end} aria-valuenow={value} aria-valuetext={format(value)}
      onPointerDown={() => { programmaticRef.current = null; }} onWheel={() => { programmaticRef.current = null; }}
      onKeyDown={event => {
        const next = { ArrowUp: value - 1, ArrowDown: value + 1, PageUp: value - 5, PageDown: value + 5, Home: start, End: end }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        choose(next);
      }}
      onScroll={event => {
        const next = Math.max(start, Math.min(end, start + Math.round(event.currentTarget.scrollTop / ROW_HEIGHT)));
        setHighlight(next);
        if (programmaticRef.current !== null) {
          if (next === programmaticRef.current) programmaticRef.current = null;
          return;
        }
        if (next !== value) onChange(next);
      }}>
      {values.map(option => <button type="button" key={option} tabIndex={-1} aria-hidden="true"
        className={`transaction-date-option ${option === highlight ? "is-selected" : ""}`}
        onClick={() => choose(option)}>{format(option)}</button>)}
    </div>
  </div>;
}

function DatePicker({ value, onApply, onClose }) {
  const [draft, setDraft] = useState(() => parseTransactionDate(value));
  const dialogRef = useRef(null);
  const headingId = useId();
  const yearLimit = Math.max(2100, today().year + 20, draft.year);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById("root");
    const previousInert = appRoot?.inert;
    if (appRoot) appRoot.inert = true;
    document.body.style.overflow = "hidden";
    dialogRef.current.querySelector('[role="spinbutton"]').focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = previousInert;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  const change = (field, next) => setDraft(current => {
    const changed = { ...current, [field]: next };
    return { ...changed, day: Math.min(changed.day, daysInMonth(changed.year, changed.month)) };
  });

  return createPortal(<div className="transaction-date-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialogRef} className="transaction-date-picker" role="dialog" aria-modal="true" aria-labelledby={headingId}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key !== "Tab") return;
        const controls = Array.from(dialogRef.current.querySelectorAll('button:not([tabindex="-1"]), [tabindex="0"]'));
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <div className="transaction-date-heading">
        <div><span>TRANSACTION DATE</span><h3 id={headingId}>Choose a date</h3></div>
        <button type="button" className="transaction-date-dismiss" onClick={onClose} aria-label="Close date picker"><FaTimes /></button>
      </div>
      <div className="transaction-date-summary">
        <span aria-live="polite">{draft.day} {MONTHS[draft.month - 1]} {draft.year}</span>
        <button type="button" className="transaction-date-today" onClick={() => setDraft(today())}>Today</button>
      </div>
      <div className="transaction-date-wheels">
        <DateWheel label="Day" values={range(1, daysInMonth(draft.year, draft.month))} value={draft.day} onChange={next => change("day", next)} format={pad} />
        <DateWheel label="Month" values={range(1, 12)} value={draft.month} onChange={next => change("month", next)} format={next => MONTHS[next - 1]} />
        <DateWheel label="Year" values={range(1900, yearLimit)} value={draft.year} onChange={next => change("year", next)} />
      </div>
      <div className="transaction-date-actions">
        <button type="button" className="transaction-date-cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="transaction-date-apply" onClick={() => onApply(replaceTransactionDate(value, draft))}>Set date</button>
      </div>
    </div>
  </div>, document.body);
}

export default function TransactionDateField({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  return <div className="transaction-date-field">
    <input type="text" aria-label="date" value={value ?? ""} disabled={disabled} onChange={event => onChange(event.target.value)} />
    <button type="button" className="transaction-date-trigger" aria-label="Choose transaction date" aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={event => { event.preventDefault(); event.currentTarget.focus(); setOpen(true); }}><FaCalendarAlt /></button>
    {open && <DatePicker value={value} onClose={() => setOpen(false)} onApply={next => { onChange(next); setOpen(false); }} />}
  </div>;
}
