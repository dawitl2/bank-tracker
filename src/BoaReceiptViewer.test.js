import { act, fireEvent, render, screen } from "@testing-library/react";
import BoaReceiptViewer from "./BoaReceiptViewer";
import ReceiptLink from "./ReceiptLink";
import { rememberSavedReceipt } from "./boaReceipt";

const token = "FT26082QM3HF41349";
const transaction = { amount: "2000.00", date: "23/03/26 12:26", reference: "FT26082QM3HF", narrative: "<script>bad()</script>", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF413499" };
const apiOrigin = new URL(process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com").origin;

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/slip/?trx=" + token);
});
afterEach(() => { jest.useRealTimers(); });
function notify(type, overrides = {}) {
  const frame = screen.getByTitle("Receipt");
  act(() => window.dispatchEvent(new MessageEvent("message", {
    source: frame.contentWindow, origin: apiOrigin, data: { type, token }, ...overrides
  })));
}

test("opens the actual bank page first without a generated receipt or toolbar", () => {
  rememberSavedReceipt(token, transaction);
  render(<BoaReceiptViewer />);
  const frame = screen.getByTitle("Receipt");
  expect(frame.src).toContain("/receipt-page?trx=" + token);
  expect(frame).not.toHaveAttribute("srcdoc");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(document.title).toBe("Receipt");
});

test("switches quietly to escaped saved fields only after a bank failure", () => {
  rememberSavedReceipt(token, transaction);
  render(<BoaReceiptViewer />);
  notify("boa-receipt-failed");
  const doc = screen.getByTitle("Receipt").srcdoc;
  expect(doc).toContain("ETB 2000.00");
  expect(doc).toContain("&lt;script&gt;bad()&lt;/script&gt;");
  expect(doc).not.toContain("<script>");
  expect(doc).toContain("/boa-receipt/bank.css");
  expect(doc).not.toContain("unavailable");
  expect(doc).not.toContain("verify payment");
});

test("waits for bank data and cancels the deadline when real fields finish loading", () => {
  jest.useFakeTimers();
  rememberSavedReceipt(token, transaction);
  render(<BoaReceiptViewer />);
  act(() => jest.advanceTimersByTime(29000));
  expect(screen.getByTitle("Receipt")).not.toHaveAttribute("srcdoc");
  notify("boa-receipt-ready");
  act(() => jest.advanceTimersByTime(60000));
  expect(screen.getByTitle("Receipt")).not.toHaveAttribute("srcdoc");
});

test("a stalled page uses saved details at the deadline", () => {
  jest.useFakeTimers();
  rememberSavedReceipt(token, transaction);
  render(<BoaReceiptViewer />);
  act(() => jest.advanceTimersByTime(30000));
  expect(screen.getByTitle("Receipt").srcdoc).toContain("ETB 2000.00");
});

test("ignores messages from another origin, frame, or transaction", () => {
  rememberSavedReceipt(token, transaction);
  render(<BoaReceiptViewer />);
  notify("boa-receipt-failed", { origin: "https://example.com" });
  notify("boa-receipt-failed", { source: window });
  notify("boa-receipt-failed", { data: { type: "boa-receipt-failed", token: "FT26082OTHER41349" } });
  expect(screen.getByTitle("Receipt")).not.toHaveAttribute("srcdoc");
});

test("shared links can fall back to the generic receipt without invented details", () => {
  render(<BoaReceiptViewer />);
  notify("boa-receipt-failed");
  expect(screen.getByTitle("Receipt").srcdoc).toContain("Download PDF");
  expect(screen.getByTitle("Receipt").srcdoc).not.toContain("Transferred amount");
});

test("More is a native app-domain new-tab link, including modified clicks", () => {
  render(<ReceiptLink transaction={transaction}>More</ReceiptLink>);
  const link = screen.getByRole("link", { name: "More" });
  expect(link).toHaveAttribute("href", "/slip/?trx=" + token);
  expect(link).toHaveAttribute("target", "_blank");
  fireEvent.click(link, { ctrlKey: true });
  expect(JSON.parse(localStorage.getItem("receipt-handoff:" + token)).transaction.amount).toBe("2000.00");
  expect(screen.queryByTitle("Receipt")).not.toBeInTheDocument();
});

test("other receipt hosts keep their normal link", () => {
  render(<ReceiptLink transaction={{ receipt_url: "https://example.com/receipt" }}>More</ReceiptLink>);
  expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("href", "https://example.com/receipt");
});

test("invalid tokens do not load the bank page", () => {
  window.history.replaceState({}, "", "/slip/?trx=bad%26trx%3DFT26082QM3HF41349");
  render(<BoaReceiptViewer />);
  expect(screen.queryByTitle("Receipt")).not.toBeInTheDocument();
});
