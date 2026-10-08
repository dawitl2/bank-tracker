import { bankReceiptRows, getBoaReceiptLink, savedReceiptRows } from "./boaReceipt";

test("corrects only the confirmed extra digit and preserves the working receipt", () => {
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF413499")).toEqual({ token: "FT26082QM3HF41349", url: "https://cs.bankofabyssinia.com/slip/?trx=FT26082QM3HF41349", corrected: true });
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT262485K1B810104").corrected).toBe(false);
  expect(getBoaReceiptLink("https://cs.bankofabyssinia.com/slip/?trx=FT26082OTHER413499").token).toBe("FT26082OTHER413499");
});

test.each(["https://example.com/slip/?trx=FT262485K1B810104", "https://cs.bankofabyssinia.com.evil.example/slip/?trx=FT262485K1B810104", "javascript:alert(1)", "https://cs.bankofabyssinia.com/slip/", "ocr-image"]) ("does not treat %s as a bank receipt", url => {
  expect(getBoaReceiptLink(url)).toBeNull();
});

test("a saved receipt uses its own fields and never invents charges or account details", () => {
  expect(savedReceiptRows({ amount: "ETB 2,000.00", date: "23/03/26 12:26", reference: "FT26082QM3HF", narrative: "<script>alert(1)</script>" })).toEqual([
    ["Transferred amount", "ETB 2000.00"], ["Transaction Date", "23/03/26 12:26"], ["Transaction Reference", "FT26082QM3HF"], ["Narrative", "<script>alert(1)</script>"]
  ]);
});

test("an unknown saved amount is omitted instead of becoming zero", () => {
  expect(savedReceiptRows({ amount: "unknown", reference: "FT26082QM3HF" })).toEqual([["Transaction Reference", "FT26082QM3HF"]]);
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
