import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import TransactionDateField, { parseTransactionDate, replaceTransactionDate } from "./TransactionDateField";
import ReceiptModal from "./ReceiptModal";

function Harness({ initial = "31/01/26 14:35:07" }) {
  const [value, setValue] = useState(initial);
  return <TransactionDateField value={value} onChange={setValue} />;
}

test("date wheels clamp impossible days while preserving the transaction time and format", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Month" }), { key: "ArrowDown" });
  expect(screen.getByRole("spinbutton", { name: "Day" })).toHaveAttribute("aria-valuenow", "28");
  expect(screen.getByLabelText("date")).toHaveValue("31/01/26 14:35:07");
  fireEvent.click(screen.getByRole("button", { name: "Set date" }));
  expect(screen.getByLabelText("date")).toHaveValue("28/02/26 14:35:07");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Choose transaction date" })).toHaveFocus();
});

test("Today uses the device's actual local calendar date and waits for Set date", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 8, 19, 20));
  try {
    render(<Harness initial="12/03/2024 09:10" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByRole("spinbutton", { name: "Day" })).toHaveAttribute("aria-valuenow", "8");
    expect(screen.getByRole("spinbutton", { name: "Month" })).toHaveAttribute("aria-valuenow", "10");
    expect(screen.getByRole("spinbutton", { name: "Year" })).toHaveAttribute("aria-valuenow", "2026");
    expect(screen.getByLabelText("date")).toHaveValue("12/03/2024 09:10");
    fireEvent.click(screen.getByRole("button", { name: "Set date" }));
    expect(screen.getByLabelText("date")).toHaveValue("08/10/2026 09:10");
  } finally { jest.useRealTimers(); }
});

test("moving from a leap year clamps February 29 without changing the recorded time", () => {
  render(<Harness initial="29/02/2024 06:45" />);
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Year" }), { key: "ArrowDown" });
  expect(screen.getByRole("spinbutton", { name: "Day" })).toHaveAttribute("aria-valuemax", "28");
  fireEvent.click(screen.getByRole("button", { name: "Set date" }));
  expect(screen.getByLabelText("date")).toHaveValue("28/02/2025 06:45");
});

test("Cancel and Escape discard wheel changes, and keyboard focus stays inside the picker", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  const apply = screen.getByRole("button", { name: "Set date" });
  apply.focus();
  fireEvent.keyDown(apply, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Close date picker" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Year" }), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByLabelText("date")).toHaveValue("31/01/26 14:35:07");
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

test("scrolling a wheel and immediately applying keeps the visible selected date", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  const day = screen.getByRole("spinbutton", { name: "Day" });
  fireEvent.pointerDown(day);
  fireEvent.scroll(day, { target: { scrollTop: 9 * 44 } });
  fireEvent.click(screen.getByRole("button", { name: "Set date" }));
  expect(screen.getByLabelText("date")).toHaveValue("10/01/26 14:35:07");
});

test("handles leap days, ISO dates, two-digit years, and missing dates without shifting timezones", () => {
  expect(parseTransactionDate("29/02/24 08:00")).toEqual({ day: 29, month: 2, year: 2024 });
  expect(parseTransactionDate("2024-02-29T08:00:00+03:00")).toEqual({ day: 29, month: 2, year: 2024 });
  expect(replaceTransactionDate("2024-02-29T08:00:00+03:00", { day: 8, month: 10, year: 2026 })).toBe("2026-10-08T08:00:00+03:00");
  expect(replaceTransactionDate("01-01-26", { day: 2, month: 9, year: 1999 })).toBe("02-09-1999");
  expect(replaceTransactionDate(null, { day: 8, month: 10, year: 2026 })).toBe("08/10/2026");
});

test("the edit transaction form wires the date picker to its existing draft change handler", () => {
  const handleDraftChange = jest.fn();
  render(<ReceiptModal showModal receiptDraft={{ id: 5, date: "31/01/26 14:35" }} personOptions={[]} handleDraftChange={handleDraftChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose transaction date" }));
  fireEvent.keyDown(screen.getByRole("spinbutton", { name: "Day" }), { key: "ArrowUp" });
  fireEvent.click(screen.getByRole("button", { name: "Set date" }));
  expect(handleDraftChange).toHaveBeenCalledWith("date", "30/01/26 14:35");
});
