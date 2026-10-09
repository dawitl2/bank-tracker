import { act, fireEvent, render, screen } from "@testing-library/react";
import ApolloTransactionPrompt from "./ApolloTransactionPrompt";
import Balance from "./Balance";
import DesktopDashboard from "./desktop/DesktopDashboard";
jest.mock("./Construction3D", () => () => null);
jest.mock("./Users", () => () => null);

const event = { message_hash: "sms-latest", sms_received_at: "2026-10-09T08:30:00Z", transaction_type: "withdrawal", amount: "1200.50", raw_reference: "FT26282TEST", narrative: "Materials", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349" };
const personOptions = [{ value: "mihret", label: "Mihret" }, { value: "null", label: "Null" }];
beforeEach(() => {
  localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ event, already_added: false }) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
async function authenticate(password = "pass") {
  fireEvent.change(screen.getByLabelText("Apollo password"), { target: { value: password } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Check latest", exact: true })); });
}

test("manual check requires the Apollo password and uses the plus button endpoint", async () => {
  const onAdded = jest.fn();
  const { rerender } = render(<ApolloTransactionPrompt personOptions={personOptions} onAdded={onAdded} />);
  expect(fetch).not.toHaveBeenCalled();
  rerender(<ApolloTransactionPrompt requestId={1} personOptions={personOptions} onAdded={onAdded} />);
  await authenticate("wrong");
  expect(screen.getByRole("alert")).toHaveTextContent("Incorrect Apollo password");
  expect(fetch).not.toHaveBeenCalled();
  await authenticate();
  expect(screen.getByText("ETB 1,200.50")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add transaction" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Who is this transaction for?"), { target: { value: "mihret" } });
  const transaction = { id: 8, reference: event.raw_reference };
  fetch.mockResolvedValueOnce({ ok: true, json: async () => transaction });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add transaction" })); });
  expect(fetch.mock.calls[1][0]).toMatch(/\/transactions$/);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ amount: "1200.50", date: "09/10/26 11:30", reference: event.raw_reference, narrative: "Materials", receipt_url: event.receipt_url, is_withdraw: true, person: "mihret", _boa_sms_message_hash: "sms-latest" });
  expect(onAdded).toHaveBeenCalledWith(transaction);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test.each([true, false])("existing latest transaction shows confirmation without offering older SMS (server match %s)", async serverMatch => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ event, already_added: serverMatch }) });
  render(<ApolloTransactionPrompt requestId={1} transactions={[{ reference: event.raw_reference }]} personOptions={personOptions} />);
  await authenticate();
  expect(screen.getByText("The latest BOA SMS is already in your transaction table.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add transaction" })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("Later allows another manual check and requires a fresh password", async () => {
  const { rerender } = render(<ApolloTransactionPrompt requestId={1} personOptions={personOptions} />);
  await authenticate();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  rerender(<ApolloTransactionPrompt requestId={2} personOptions={personOptions} />);
  expect(screen.getByLabelText("Apollo password")).toHaveValue("");
  expect(fetch).toHaveBeenCalledTimes(1);
  await authenticate();
  expect(screen.getByRole("dialog", { name: "Add the latest transaction?" })).toBeInTheDocument();
});

test("closing a pending check cancels it and prevents a late popup", async () => {
  let resolve;
  fetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<ApolloTransactionPrompt requestId={1} />);
  await authenticate();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => { resolve({ ok: true, json: async () => ({ event }) }); });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("empty SMS history and service errors have useful feedback and retry", async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ event: null }) });
  render(<ApolloTransactionPrompt requestId={1} />);
  await authenticate();
  expect(screen.getByText("No BOA SMS transactions yet")).toBeInTheDocument();
  fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Service unavailable" }) });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
  expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
});

test("a newer SMS during save offers another check instead of saving a stale transaction", async () => {
  const onAdded = jest.fn();
  render(<ApolloTransactionPrompt requestId={1} personOptions={personOptions} onAdded={onAdded} />);
  await authenticate();
  fireEvent.change(screen.getByLabelText("Who is this transaction for?"), { target: { value: "mihret" } });
  fetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: "A newer BOA SMS is available" }) });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add transaction" })); });
  expect(onAdded).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("A newer BOA SMS");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
});

test("mobile primary and locked Apollo both offer a manual check; Interest does not", async () => {
  jest.useFakeTimers();
  const props = { balance: 1000, boaSmsState: {}, currentPath: "/balance", navigate: jest.fn(), personOptions };
  const { container, rerender } = render(<Balance {...props} />);
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Check latest BOA SMS from Balance" }));
  await authenticate();
  expect(screen.getByRole("dialog", { name: "Add the latest transaction?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  const rail = container.querySelector(".balance-card-rail");
  Object.defineProperty(rail.firstElementChild, "clientWidth", { value: 100 });
  rail.scrollLeft = 100; fireEvent.scroll(rail);
  await act(async () => { jest.advanceTimersByTime(320); });
  // Swiping retains the existing balance unlock modal; dismiss it to use check.
  fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Check latest BOA SMS from Apollo" }));
  expect(screen.getByLabelText("Apollo password")).toBeInTheDocument();
  await authenticate();
  expect(fetch).toHaveBeenCalledTimes(2);
  rerender(<Balance {...props} currentPath="/balance/interest" />);
  expect(screen.queryByLabelText(/Check latest BOA SMS from/)).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Add the latest transaction?" })).not.toBeInTheDocument();
});

test.each(["Balance", "Apollo"])("desktop %s card checks Apollo SMS behind its password", async card => {
  render(<DesktopDashboard currentPath="/balance" navigate={jest.fn()} personOptions={personOptions} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: `Check latest BOA SMS from ${card}` }));
  expect(fetch).not.toHaveBeenCalled();
  await authenticate();
  expect(screen.getByRole("dialog", { name: "Add the latest transaction?" })).toBeInTheDocument();
});
