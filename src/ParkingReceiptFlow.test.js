import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ParkingReceiptFlow from "./ParkingReceiptFlow";

function ParkingHarness({ onSave = jest.fn() }) {
  const [draft, setDraft] = useState({ amount: "", date: "", reference: "", narrative: "Abrihot" });
  return (
    <ParkingReceiptFlow
      parkingDraft={draft}
      setParkingDraft={setDraft}
      onSave={onSave}
      saving={false}
      saveSuccess={false}
    />
  );
}

describe("Abrihot parking scanner flow", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 2, 10, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("waits for the user to choose camera or gallery", () => {
    render(<ParkingHarness />);

    expect(screen.getByRole("button", { name: /camera take a photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gallery choose a photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter duration/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/live parking receipt camera/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("DD/MM/YYYY HH:MM:SS")).not.toBeInTheDocument();
    expect(screen.queryByText(/we only read/i)).not.toBeInTheDocument();
  });

  test("calculates the payment and offers to add it directly", () => {
    const onSave = jest.fn();
    render(<ParkingHarness onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /enter duration/i }));
    fireEvent.change(screen.getByLabelText("Hours"), { target: { value: "2" } });

    const saveButton = screen.getByRole("button", { name: /save 60\.00 etb/i });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("prices hours and minutes at the 30 ETB hourly rate", () => {
    render(<ParkingHarness />);

    fireEvent.click(screen.getByRole("button", { name: /enter duration/i }));
    fireEvent.change(screen.getByLabelText("Hours"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "5" } });

    expect(screen.getByText("6 hrs 5 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save 182\.50 etb/i })).toBeEnabled();
  });
});
