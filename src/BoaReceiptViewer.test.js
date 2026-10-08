import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BoaReceiptViewer from "./BoaReceiptViewer";
import ReceiptLink from "./ReceiptLink";
import { getBoaReceiptLink } from "./boaReceipt";

const transaction = { amount: "2000.00", date: "23/03/26 12:26", reference: "FT26082QM3HF", narrative: "<script>bad()</script>", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF413499" };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => jest.restoreAllMocks());

test("saved receipt renders immediately while the bank request is pending and escapes input", () => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  const close = jest.fn();
  render(<BoaReceiptViewer transaction={transaction} bankLink={getBoaReceiptLink(transaction.receipt_url)} onClose={close} />);
  const frame = screen.getByTitle("Bank of Abyssinia receipt copy");
  expect(frame.srcdoc).toContain("ETB 2000.00");
  expect(frame.srcdoc).toContain("FT26082QM3HF");
  expect(frame.srcdoc).not.toContain("25000.00");
  expect(frame.srcdoc).toContain("&lt;script&gt;bad()&lt;/script&gt;");
  expect(frame.srcdoc).not.toContain("<script>");
  expect(frame.srcdoc).toContain("/boa-receipt/bank.css");
  expect(screen.getByRole("link", { name: /Open bank receipt/ })).toHaveAttribute("href", "https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF41349");
  fireEvent.click(screen.getByRole("button", { name: "Close receipt" }));
  expect(close).toHaveBeenCalled();
});

test("keeps the saved receipt visible on backend failure", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  render(<BoaReceiptViewer transaction={transaction} bankLink={getBoaReceiptLink(transaction.receipt_url)} onClose={() => {}} />);
  await screen.findByText("Bank receipt unavailable. Showing saved transaction details.");
  expect(screen.getByTitle("Bank of Abyssinia receipt copy").srcdoc).toContain("ETB 2000.00");
});

test("adds the correct bank fields and reopens from memory without a bank request", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "FT26082QM3HF41349", data: { "Transferred Amount": "2000.00", "Transaction Date": "23/03/26 12:26", "Transaction Reference": "FT26082QM3HF", "Service Charge": "10", "VAT (15%)": "1.5", "Total Amount including VAT": "2012.00" } }) });
  const props = { transaction, bankLink: getBoaReceiptLink(transaction.receipt_url), onClose: () => {} };
  const { unmount } = render(<BoaReceiptViewer {...props} />);
  await screen.findByText("Bank Tracker copy · Details loaded from the bank.");
  expect(screen.getByTitle("Bank of Abyssinia receipt copy").srcdoc).toContain("ETB 2012.00");
  unmount();
  render(<BoaReceiptViewer {...props} />);
  expect(screen.getByText("Bank Tracker copy · Details loaded from the bank.")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("a slow bank request stops after six seconds without hiding the saved copy", async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
  const slow = { ...transaction, receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082SLOW141349" };
  const { unmount } = render(<BoaReceiptViewer transaction={slow} bankLink={getBoaReceiptLink(slow.receipt_url)} onClose={() => {}} />);
  expect(screen.getByTitle("Bank of Abyssinia receipt copy").srcdoc).toContain("ETB 2000.00");
  await waitFor(() => expect(screen.getByText("Bank receipt unavailable. Showing saved transaction details.")).toBeInTheDocument(), { timeout: 6500 });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  unmount();
  jest.useRealTimers();
});

test("ignores a bank response for a different receipt", async () => {
  const other = { ...transaction, receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082OTHER41349" };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "FT26082OTHER41349", data: { "Transaction Reference": "FT262485K1B8", "Transferred Amount": "25000.00" } }) });
  render(<BoaReceiptViewer transaction={other} bankLink={getBoaReceiptLink(other.receipt_url)} onClose={() => {}} />);
  await screen.findByText("Bank receipt unavailable. Showing saved transaction details.");
  expect(screen.getByTitle("Bank of Abyssinia receipt copy").srcdoc).not.toContain("25000.00");
});

test("More opens the local viewer; other receipt hosts keep their normal link", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false });
  const { unmount } = render(<ReceiptLink transaction={transaction}>More</ReceiptLink>);
  fireEvent.click(screen.getByRole("link", { name: "More" }));
  await waitFor(() => expect(screen.getByTitle("Bank of Abyssinia receipt copy")).toBeInTheDocument());
  unmount();
  render(<ReceiptLink transaction={{ receipt_url: "https://example.com/receipt" }}>More</ReceiptLink>);
  expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("href", "https://example.com/receipt");
  expect(screen.queryByTitle("Bank of Abyssinia receipt copy")).not.toBeInTheDocument();
});
