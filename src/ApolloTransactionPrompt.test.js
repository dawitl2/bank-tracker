import { act, fireEvent, render, screen } from "@testing-library/react";
import ApolloTransactionPrompt from "./ApolloTransactionPrompt";
import Balance from "./Balance";
import DesktopDashboard from "./desktop/DesktopDashboard";
jest.mock("./Construction3D", () => () => null);
jest.mock("./Users", () => () => null);

const event = { message_hash: "sms-latest", sms_received_at: "2026-10-09T08:30:00Z", transaction_type: "withdrawal", amount: "1200.50", raw_reference: "FT26282TEST", narrative: "Materials", receipt_url: "https://cs.bankofabyssinia.com/slip/?trx=FT26282TEST41349" };
const personOptions = [{ value: "mihret", label: "Mihret" }, { value: "null", label: "Null" }];
beforeEach(() => {
  jest.useFakeTimers(); localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ event, already_added: false }) });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
async function advance(ms) { await act(async () => { jest.advanceTimersByTime(ms); }); }

test("waits two seconds, asks for a person and adds only the latest hash", async () => {
  const onAdded = jest.fn();
  render(<ApolloTransactionPrompt enabled personOptions={personOptions} onAdded={onAdded} />);
  await advance(1999); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await advance(1); expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("ETB 1,200.50")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add transaction" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Who is this transaction for?"), { target: { value: "mihret" } });
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ transaction: { id: 8, reference: event.raw_reference } }) });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Add transaction" })); });
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ message_hash: "sms-latest", person: "mihret" });
  expect(onAdded).toHaveBeenCalledWith({ id: 8, reference: event.raw_reference });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("never prompts for an already saved latest SMS or drains older messages", async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ event, already_added: true }) });
  render(<ApolloTransactionPrompt enabled personOptions={personOptions} />);
  await advance(2000); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("leaving Apollo cancels the timer and closes an open dialog", async () => {
  const { rerender } = render(<ApolloTransactionPrompt enabled personOptions={personOptions} />);
  await advance(1000);
  rerender(<ApolloTransactionPrompt enabled={false} personOptions={personOptions} />);
  await advance(2000); expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  rerender(<ApolloTransactionPrompt enabled personOptions={personOptions} />);
  await advance(2000); expect(screen.getByRole("dialog")).toBeInTheDocument();
  rerender(<ApolloTransactionPrompt enabled={false} personOptions={personOptions} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("Later suppresses this SMS for this visit, but leaves it available on a later app visit", async () => {
  const { rerender } = render(<ApolloTransactionPrompt enabled personOptions={personOptions} />);
  await advance(2000);
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  rerender(<ApolloTransactionPrompt enabled={false} personOptions={personOptions} />);
  rerender(<ApolloTransactionPrompt enabled personOptions={personOptions} />);
  await advance(2000); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("mobile prompts only on Apollo after the correct password, never primary or interest", async () => {
  const props = { balance: 1000, boaSmsState: {}, currentPath: "/balance", navigate: jest.fn(), personOptions };
  const { container, rerender } = render(<Balance {...props} />);
  await advance(2500); expect(fetch).not.toHaveBeenCalled();
  const rail = container.querySelector(".balance-card-rail");
  Object.defineProperty(rail.firstElementChild, "clientWidth", { value: 100 });
  rail.scrollLeft = 100; fireEvent.scroll(rail); await advance(320);
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await advance(2500); expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pass" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await advance(1999); expect(screen.queryByRole("dialog", { name: "Add the latest transaction?" })).not.toBeInTheDocument();
  await advance(1); expect(screen.getByRole("dialog", { name: "Add the latest transaction?" })).toBeInTheDocument();
  rerender(<Balance {...props} currentPath="/balance/interest" />);
  expect(screen.queryByRole("dialog", { name: "Add the latest transaction?" })).not.toBeInTheDocument();
});

test("desktop unlock uses the same latest-only prompt", async () => {
  render(<DesktopDashboard currentPath="/balance" navigate={jest.fn()} personOptions={personOptions} />);
  await advance(2500); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Unlock Apollo SMS" }));
  fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: "pass" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock" }));
  await advance(2000); expect(screen.getByRole("dialog", { name: "Add the latest transaction?" })).toBeInTheDocument();
});
