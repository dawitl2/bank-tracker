import {
  calculateParkingCharge,
  extractParkingDateTime,
  formatParkingDuration,
  parseParkingDateTime
} from "./parkingReceipt";

describe("Abrihot parking receipt helpers", () => {
  test("extracts the printed entry date and time from OCR text", () => {
    const text = "52401-2609020748096\n02/09/26 07:48:09 LE: 01\nLicence Plate: NOT READ";
    expect(extractParkingDateTime(text)).toBe("02/09/2026 07:48:09");
  });

  test("calculates 30 ETB per hour, prorated to the minute", () => {
    const entry = parseParkingDateTime("02/09/2026 07:48:09");
    const now = new Date(2026, 8, 2, 10, 18, 9);
    const charge = calculateParkingCharge(entry, now);

    expect(charge.elapsedMinutes).toBe(150);
    expect(charge.amount).toBe(75);
    expect(formatParkingDuration(charge.elapsedMinutes)).toBe("2 hrs 30 min");
  });

  test("rejects a scanned time in the future", () => {
    const entry = parseParkingDateTime("03/09/2026 07:48:09");
    const now = new Date(2026, 8, 2, 10, 18, 9);
    expect(calculateParkingCharge(entry, now).error).toMatch(/future/i);
  });
});
