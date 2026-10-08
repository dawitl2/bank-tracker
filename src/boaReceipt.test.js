import { bankReceiptRows, getBoaReceiptLink, savedReceiptRows, rememberSavedReceipt, readSavedReceipt, isDawitTransaction, generateHashedAccount } from "./boaReceipt";

test("saved handoff excludes unrelated fields, is consumed once, and survives a tab reload", () => {
  localStorage.clear(); sessionStorage.clear();
  rememberSavedReceipt("FT26082QM3HF41349", { amount: 20, reference: "DEMO", account: "must not persist" });
  expect(readSavedReceipt("FT26082QM3HF41349")).toEqual({ amount: 20, reference: "DEMO" });
  expect(localStorage.getItem("receipt-handoff:FT26082QM3HF41349")).toBeNull();
  expect(readSavedReceipt("FT26082QM3HF41349")).toEqual({ amount: 20, reference: "DEMO" });
});

test("expired handoffs cannot show stale transaction details", () => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem("receipt-handoff:FT26082QM3HF41349", JSON.stringify({ expires: Date.now() - 1, transaction: { amount: 99 } }));
  expect(readSavedReceipt("FT26082QM3HF41349")).toBeNull();
  expect(localStorage.getItem("receipt-handoff:FT26082QM3HF41349")).toBeNull();
});

test("corrects only the confirmed extra digit and preserves the working receipt", () => {
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF413499")).toEqual({ token: "FT26082QM3HF41349", url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF41349", corrected: true });
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT262485K1B810104").corrected).toBe(false);
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT26082OTHER413499").token).toBe("FT26082OTHER413499");
});

test.each(["https://example.com/slip/?trx=FT262485K1B810104", "https://cs.bankofabyssinia.com.evil.example/slip/?trx=FT262485K1B810104", "javascript:alert(1)", "https://cs.bankofabyssinia.com/slip/", "ocr-image"]) ("does not treat %s as a bank receipt", url => {
  expect(getBoaReceiptLink(url)).toBeNull();
});

test("a saved receipt populates static and generated fields without placeholders or phone number", () => {
  const rows = savedReceiptRows({ amount: "ETB 2,000.00", date: "23/03/26 12:26", reference: "FT26082QM3HF", narrative: "<script>alert(1)</script>" });
  const rowMap = Object.fromEntries(rows);
  expect(rowMap["Source Account Name"]).toBe("DAWIT ENKU");
  expect(rowMap["Transferred amount"]).toBe("ETB 2000.00");
  expect(rowMap["Service Charge"]).toBe("ETB 10.00");
  expect(rowMap["VAT (15%)"]).toBe("ETB 1.50");
  expect(rowMap["Total Amount"]).toBe("ETB 2011.50");
  expect(rowMap["Transaction Date"]).toBe("23/03/26 12:26");
  expect(rowMap["Transaction Type"]).toBe("Account Transfer");
  expect(rowMap["Transaction Reference"]).toBe("FT26082QM3HF");
  expect(rowMap.Narrative).toBe("<script>alert(1)</script>");
  expect(rowMap["Phone Number"]).toBeUndefined();
  expect(rowMap["Source Account"]).toMatch(/^\d\*{6}\d{2}$/);
  expect(rows.some(([, value]) => value === "—")).toBe(false);
});

test("isDawitTransaction identifies Dawit withdrawals and rejects deposits and other users", () => {
  expect(isDawitTransaction({ person: "Dawit", is_withdraw: true })).toBe(true);
  expect(isDawitTransaction({ person: "dawit", is_withdraw: true })).toBe(true);
  expect(isDawitTransaction({ person: "Dawit", is_withdraw: false })).toBe(false);
  expect(isDawitTransaction({ person: "yiss", is_withdraw: true })).toBe(false);
  expect(isDawitTransaction({ person: "mihret", is_withdraw: true })).toBe(false);
  expect(isDawitTransaction({ person: "asnake", is_withdraw: true })).toBe(false);
  expect(isDawitTransaction({ person: "enku", is_withdraw: true })).toBe(false);
  expect(isDawitTransaction(null)).toBe(false);
  expect(isDawitTransaction({})).toBe(false);
});

test("generateHashedAccount generates valid masked account with first and last two digits", () => {
  const acct = generateHashedAccount("FT26082QM3HF");
  expect(acct).toMatch(/^\d\*{6}\d{2}$/);
  expect(generateHashedAccount("FT26082QM3HF")).toBe(acct);
});

test("matches the reference receipt order and hides zero charges and redundant total", () => {
  const data = { "Transferred Amount": "25000.00", "Service Charge": "0", "VAT (15%)": "0", "Total Amount including VAT": "25000.00", "Receiver's Account": "1******49", "Receiver's Name": "DEMO RECEIVER", "Transaction Date": "05/09/26 15:52", "Transaction Type": "EthSwitch Transfer For inc via IPS", "Transaction Reference": "FT262485K1B8", Narrative: "FT26248697NL" };
  expect(bankReceiptRows(data)).toEqual([
    ["Transferred amount", "ETB 25000.00"], ["Receiver's Account", "1******49"], ["Receiver's Name", "DEMO RECEIVER"], ["Transaction Date", "05/09/26 15:52"], ["Transaction Type", "Other Bank Transfer"], ["Transaction Reference", "FT262485K1B8"], ["Narrative", "FT26248697NL"]
  ]);
  expect(data["Transaction Type"]).toBe("EthSwitch Transfer For inc via IPS");
});

test("keeps the recovered receipt's actual fees, total, and phone number", () => {
  const rows = bankReceiptRows({ "Transferred Amount": "2000.00", "Service Charge": "10", "VAT (15%)": "1.5", "Total Amount including VAT": "2012.00", "Payment Reference": "911000000", "Transaction Type": "telebirr", "Transaction Reference": "FT26082QM3HF", "Transaction Date": "23/03/26 12:26" });
  expect(rows).toEqual(expect.arrayContaining([["Service Charge", "ETB 10.00"], ["VAT (15%)", "ETB 1.50"], ["Total Amount", "ETB 2012.00"], ["Phone Number", "911000000"]]));
});
