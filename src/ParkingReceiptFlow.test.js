import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ParkingReceiptFlow from "./ParkingReceiptFlow";

function ParkingHarness({ onSave = jest.fn(), initialDraft = {} }) {
  const [draft, setDraft] = useState({ amount: "", date: "", reference: "", narrative: "Abrihot", ...initialDraft });
  return (
    <ParkingReceiptFlow
      parkingDraft={draft}
      setParkingDraft={setDraft}
      onSave={() => onSave(draft)}
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

    expect(screen.getByRole("button", { name: /take a ticket photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose from gallery/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enter duration/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/live parking receipt camera/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("DD/MM/YYYY HH:MM:SS")).not.toBeInTheDocument();
    expect(screen.queryByText(/we only read/i)).not.toBeInTheDocument();
  });

  test("camera requests native rear capture while gallery remains a plain image picker", () => {
    const inputClick = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    render(<ParkingHarness />);
    const cameraInput = screen.getByLabelText("Take parking ticket photo");
    const galleryInput = screen.getByLabelText("Choose parking ticket from gallery");

    expect(inputClick).not.toHaveBeenCalled();
    expect(cameraInput).toHaveAttribute("capture", "environment");
    expect(cameraInput).toHaveAttribute("accept", "image/*");
    expect(galleryInput).not.toHaveAttribute("capture");
    fireEvent.click(screen.getByRole("button", { name: /take a ticket photo/i }));
    expect(inputClick.mock.instances[0]).toBe(cameraInput);
    fireEvent.click(screen.getByRole("button", { name: /choose from gallery/i }));
    expect(inputClick.mock.instances[1]).toBe(galleryInput);
    inputClick.mockRestore();
  });

  test("canceling the native camera leaves the chooser unchanged", () => {
    render(<ParkingHarness />);
    fireEvent.change(screen.getByLabelText("Take parking ticket photo"), { target: { files: [] } });
    expect(screen.getByRole("button", { name: /take a ticket photo/i })).toBeInTheDocument();
    expect(screen.queryByText("Reading ticket")).not.toBeInTheDocument();
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

  test("prices hours and minutes in started-hour blocks", () => {
    render(<ParkingHarness />);

    fireEvent.click(screen.getByRole("button", { name: /enter duration/i }));
    fireEvent.change(screen.getByLabelText("Hours"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "5" } });

    expect(screen.getByText("6 hrs 5 min")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save 210\.00 etb/i })).toBeEnabled();
  });

  test("saves a short manual stay at the minimum 30 ETB price", () => {
    const onSave = jest.fn();
    render(<ParkingHarness onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /enter duration/i }));
    expect(screen.getByRole("button", { name: /enter parking duration/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /save 30\.00 etb/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: "30.00", narrative: "Abrihot" }));
  });

  test("a scanned entry increases to the next block only after a full hour", () => {
    const onSave = jest.fn();
    render(<ParkingHarness initialDraft={{ date: "02/09/2026 09:00:00" }} onSave={onSave} />);
    expect(screen.getByRole("button", { name: /save 30\.00 etb/i })).toBeEnabled();
    act(() => jest.advanceTimersByTime(1));
    fireEvent.click(screen.getByRole("button", { name: /save 60\.00 etb/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ amount: "60.00", date: "02/09/2026 09:00:00" }));
  });
});
