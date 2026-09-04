export const PARKING_RATE_PER_HOUR = 30;

// Parking is sold in started, entry-relative hour blocks, not prorated minutes.
// A valid entry starts the first block immediately; invalid durations cost nothing.
export const calculateParkingAmount = (elapsedMinutes) => {
  if (!Number.isFinite(elapsedMinutes) || elapsedMinutes < 0) return 0;
  return Math.max(1, Math.ceil(elapsedMinutes / 60)) * PARKING_RATE_PER_HOUR;
};

const RECEIPT_DATE_PATTERN =
  /(\d{1,2})\s*[/-]\s*(\d{1,2})\s*[/-]\s*(\d{2,4})[,\s]+(\d{1,2})\s*[:.]\s*(\d{2})(?:\s*[:.]\s*(\d{2}))?/;
const RECEIPT_TIME_PATTERN =
  /(?:^|[^\d])([0-2OQDGg]?\d)\s*[:.]\s*([0-5S]\d)\s*[:.]\s*([0-5S]\d)(?!\d)/;

const expandYear = (year) => {
  const value = Number(year);
  if (String(year).length === 4) return value;
  return value >= 70 ? 1900 + value : 2000 + value;
};

const pad = (value) => String(value).padStart(2, "0");

export const formatParkingDateTime = (date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

export const extractParkingDateTime = (rawText = "") => {
  const cleanedText = rawText
    .replace(/\r/g, "\n")
    .replace(/[Oo](?=\d|[/-])/g, "0")
    .replace(/[Il](?=\d|:)/g, "1");
  const match = cleanedText.match(RECEIPT_DATE_PATTERN);

  if (!match) return "";

  const [, day, month, year, hour, minute, second = "00"] = match;
  const parsed = new Date(
    expandYear(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  const isValid =
    parsed.getFullYear() === expandYear(year) &&
    parsed.getMonth() === Number(month) - 1 &&
    parsed.getDate() === Number(day) &&
    parsed.getHours() === Number(hour) &&
    parsed.getMinutes() === Number(minute);

  return isValid ? formatParkingDateTime(parsed) : "";
};

export const parseParkingDateTime = (value = "") => {
  const normalized = extractParkingDateTime(value);
  if (!normalized) return null;

  const match = normalized.match(RECEIPT_DATE_PATTERN);
  const [, day, month, year, hour, minute, second = "00"] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
};

const normalizeOcrNumber = (value) =>
  Number(String(value).replace(/[OQDGg]/g, "0").replace(/S/g, "5"));

export const extractParkingTimestamp = (rawText = "", referenceDate = new Date()) => {
  const exactDateText = extractParkingDateTime(rawText);
  const exactDate = exactDateText ? parseParkingDateTime(exactDateText) : null;
  const maximumFutureTime = referenceDate.getTime() + 5 * 60 * 1000;
  const oldestLikelyTicket = referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000;

  if (
    exactDate &&
    exactDate.getTime() <= maximumFutureTime &&
    exactDate.getTime() >= oldestLikelyTicket
  ) {
    return { date: exactDateText, usedTodayFallback: false };
  }

  const timeMatch = rawText.match(RECEIPT_TIME_PATTERN);
  if (!timeMatch) return { date: "", usedTodayFallback: false };

  const detectedTime = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    normalizeOcrNumber(timeMatch[1]),
    normalizeOcrNumber(timeMatch[2]),
    normalizeOcrNumber(timeMatch[3])
  );

  // A late-night ticket scanned shortly after midnight belongs to yesterday.
  if (detectedTime.getTime() - referenceDate.getTime() > 12 * 60 * 60 * 1000) {
    detectedTime.setDate(detectedTime.getDate() - 1);
  }

  return { date: formatParkingDateTime(detectedTime), usedTodayFallback: true };
};

export const calculateParkingCharge = (entryDate, currentDate = new Date()) => {
  if (!(entryDate instanceof Date) || Number.isNaN(entryDate.getTime())) {
    return { amount: 0, elapsedMinutes: 0, error: "Enter a valid receipt date and time." };
  }

  const elapsedMilliseconds = currentDate.getTime() - entryDate.getTime();
  if (elapsedMilliseconds < 0) {
    return { amount: 0, elapsedMinutes: 0, error: "The entry time is in the future. Check the scanned date." };
  }

  const elapsedMinutes = elapsedMilliseconds / 60000;
  const amount = calculateParkingAmount(elapsedMinutes);

  return { amount, elapsedMinutes, error: "" };
};

export const formatParkingDuration = (elapsedMinutes) => {
  if (elapsedMinutes < 1) return "Less than a minute";

  const wholeMinutes = Math.floor(elapsedMinutes);
  const hours = Math.floor(wholeMinutes / 60);
  const minutes = wholeMinutes % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
};
