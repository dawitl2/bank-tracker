import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BrowserApp from "./BrowserApp";
import BoaReceiptViewer from "./BoaReceiptViewer";
import ReceiptLink from "./ReceiptLink";

const transaction = { amount: 42, reference: "DEMO", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082TEST41349" };
function TestApp() {
  const [count, setCount] = useState(0);
  return <><button onClick={() => setCount(count + 1)}>Filter {count}</button><ReceiptLink transaction={transaction}>More</ReceiptLink></>;
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, "", "/transactions");
});

test("More opens a receipt without reloading; device Back restores the same app state", async () => {
  render(<BrowserApp AppComponent={TestApp} ReceiptComponent={BoaReceiptViewer} />);
  fireEvent.click(screen.getByRole("button", { name: "Filter 0" }));
  fireEvent.click(screen.getByRole("link", { name: "More" }));
  expect(window.location.pathname).toBe("/slip/");
  expect(window.history.state.receipt).toBe(true);
  expect(screen.getByTitle("Receipt").src).toContain("/api/boa-receipt?kind=page&trx=FT26082TEST41349");
  expect(screen.getByText("Filter 1")).not.toBeVisible();
  act(() => window.history.back());
  await waitFor(() => expect(screen.getByRole("button", { name: "Filter 1" })).toBeVisible());
  expect(window.location.pathname).toBe("/transactions");
  expect(screen.queryByTitle("Receipt")).not.toBeInTheDocument();
  expect(document.title).toBe("Bank Tracker");
  act(() => window.history.forward());
  await waitFor(() => expect(screen.getByTitle("Receipt")).toBeInTheDocument());
  expect(document.title).toBe("Receipt");
});

test("a receipt opened directly does not start dashboard data requests", () => {
  window.history.replaceState({}, "", "/slip/?trx=FT26082TEST41349");
  const dashboard = jest.fn(() => <TestApp />);
  render(<BrowserApp AppComponent={dashboard} ReceiptComponent={BoaReceiptViewer} />);
  expect(screen.getByTitle("Receipt")).toBeInTheDocument();
  expect(dashboard).not.toHaveBeenCalled();
});

test("saved fallback works in the current app even when storage is unavailable", () => {
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage disabled"); });
  try {
    render(<BrowserApp AppComponent={TestApp} ReceiptComponent={BoaReceiptViewer} />);
    fireEvent.click(screen.getByRole("link", { name: "More" }));
    const frame = screen.getByTitle("Receipt");
    act(() => window.dispatchEvent(new MessageEvent("message", {
      source: frame.contentWindow, origin: window.location.origin,
      data: { type: "boa-receipt-failed", token: "FT26082TEST41349" }
    })));
    expect(screen.getByTitle("Receipt").srcdoc).toContain("ETB 42.00");
  } finally { jest.restoreAllMocks(); }
});
