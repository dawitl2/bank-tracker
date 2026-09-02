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

    expect(screen.getByRole("button", { name: /open camera/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose from gallery/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/live parking receipt camera/i)).not.toBeInTheDocument();
  });

  test("calculates the payment and offers to add it directly", () => {
    const onSave = jest.fn();
    render(<ParkingHarness onSave={onSave} />);

    fireEvent.change(screen.getByPlaceholderText("DD/MM/YYYY HH:MM:SS"), {
      target: { value: "02/09/2026 08:00:00" }
    });

    const saveButton = screen.getByRole("button", { name: /save & add 60\.00 etb/i });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
