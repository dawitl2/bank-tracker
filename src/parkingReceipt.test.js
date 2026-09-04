import {
  calculateParkingCharge,
  calculateParkingAmount,
  extractParkingDateTime,
  extractParkingTimestamp,
  formatParkingDuration,
  parseParkingDateTime
} from "./parkingReceipt";

describe("Abrihot parking receipt helpers", () => {
  test("extracts the printed entry date and time from OCR text", () => {
    const text = "52401-2609020748096\n02/09/26 07:48:09 LE: 01\nLicence Plate: NOT READ";
    expect(extractParkingDateTime(text)).toBe("02/09/2026 07:48:09");
  });

  test("charges for every started hour instead of prorating minutes", () => {
    const entry = parseParkingDateTime("02/09/2026 07:48:09");
    const now = new Date(2026, 8, 2, 10, 18, 9);
    const charge = calculateParkingCharge(entry, now);

    expect(charge.elapsedMinutes).toBe(150);
    expect(charge.amount).toBe(90);
    expect(formatParkingDuration(charge.elapsedMinutes)).toBe("2 hrs 30 min");
  });

  test.each([
    [0, 30],
    [1 / 60, 30],
    [20, 30],
    [59.999, 30],
    [60, 30],
    [60 + 1 / 60, 60],
    [65, 60],
    [120, 60],
    [120 + 1 / 60, 90],
    [365, 210]
  ])("%s minutes costs %s ETB", (minutes, amount) => {
    expect(calculateParkingAmount(minutes)).toBe(amount);
    const entry = new Date(2026, 8, 2, 7, 48, 9);
    const current = new Date(entry.getTime() + minutes * 60000);
    expect(calculateParkingCharge(entry, current).amount).toBe(amount);
  });

  test("hour blocks run from entry time, including across midnight", () => {
    const entry = new Date(2026, 8, 2, 23, 50, 0);
    expect(calculateParkingCharge(entry, new Date(2026, 8, 3, 0, 10, 0)).amount).toBe(30);
  });

  test("invalid entry dates and durations do not produce a charge", () => {
    expect(calculateParkingCharge(null).error).toMatch(/valid/i);
    expect(calculateParkingCharge(new Date("invalid")).amount).toBe(0);
    [-1, NaN, Infinity].forEach(value => expect(calculateParkingAmount(value)).toBe(0));
  });

  test("rejects a scanned time in the future", () => {
    const entry = parseParkingDateTime("03/09/2026 07:48:09");
    const now = new Date(2026, 8, 2, 10, 18, 9);
    expect(calculateParkingCharge(entry, now).error).toMatch(/future/i);
  });

  test("recovers the sample ticket when OCR damages the printed date", () => {
    const ocrText = "$95111704576/8111704250\nUAT: 15%\n5241-26 09620748696\n/769/726 07:48:09 LE: 01";
    const scanTime = new Date(2026, 8, 2, 10, 18, 9);

    expect(extractParkingTimestamp(ocrText, scanTime)).toEqual({
      date: "02/09/2026 07:48:09",
      usedTodayFallback: true
    });
  });

  test("corrects the future day produced by OCR while preserving the time", () => {
    const ocrText = "9/09/26 07:48:09 LE: 01";
    const scanTime = new Date(2026, 8, 2, 10, 18, 9);

    expect(extractParkingTimestamp(ocrText, scanTime).date).toBe("02/09/2026 07:48:09");
  });
});
