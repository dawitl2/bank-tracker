import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { FaFacebookF, FaInstagram, FaLinkedin, FaTiktok, FaYoutube } from "react-icons/fa";
import { AiTwotoneMail } from "react-icons/ai";
import { CiPhone } from "react-icons/ci";
import { FaTelegramPlane } from "react-icons/fa";
import { bankReceiptRows, savedReceiptRows } from "./boaReceipt";
import "./BoaReceiptViewer.css";

const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";
const receiptCache = new Map();
const socials = [
  ["Facebook", "https://www.facebook.com/BoAeth/", FaFacebookF, "#1877F2"],
  ["YouTube", "https://www.youtube.com/@abyssinia_bank", FaYoutube, "#c4302b"],
  ["Telegram", "https://t.me/BoAEth", FaTelegramPlane, "#0088cc"],
  ["LinkedIn", "https://www.linkedin.com/company/bankofabyssinia/", FaLinkedin, "#0e76a8"],
  ["Instagram", "https://www.instagram.com/abyssinia_bank", FaInstagram],
  ["TikTok", "https://www.tiktok.com/@abyssinia_bank", FaTiktok]
];

function receiptDocument(rows, bankLink, bankData) {
  const assets = `${window.location.origin}${process.env.PUBLIC_URL || ""}/boa-receipt`;
  const provenance = bankData ? "Bank Tracker copy · Details retrieved from Bank of Abyssinia." : "Bank Tracker saved copy · Only saved transaction details are shown. Other bank fields are unavailable.";
  const markup = renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Bank Tracker receipt copy</title><link rel="stylesheet" href={`${assets}/bank.css`} />
      <style>{`body{background:#fff;color:#000}td{overflow-wrap:anywhere}button:focus-visible,a:focus-visible{outline:2px solid #000;outline-offset:3px}.receipt-copy-note{font-size:11px;margin:16px auto 0;color:#555}@media print{[data-download-pdf]{display:none}#root{padding:1rem}}`}</style>
    </head><body><div id="root"><div id="invoice" className="md:bg-[position:85%_65%] bg-[position:110%_65%] md:bg-[length:25%] bg-[length:40%] bg-no-repeat" style={{ backgroundImage: `url(${assets}/stamp.png)`, width: "100%", margin: "0 auto" }}>
      <div className="flex flex-col justify-center">
        <div><img src={`${assets}/logo.png`} className="md:w-80 w-60" alt="Bank of Abyssinia" /></div>
        <div className="border-t-2 border-b-2 w-full border-[#f1ab15] my-2"><h1 className="text-center text-base font-bold">Receipt</h1></div>
      </div>
      <div className="bg-contain bg-center" style={{ backgroundImage: `url(${assets}/watermark.png)`, backgroundRepeat: "no-repeat" }}>
        <table className="my-5 md:w-4/5 w-full mx-auto text-sm"><tbody>
          {rows.map(([label, value]) => <tr key={label}>
            <td style={{ borderBottom: "1px solid black", borderLeft: "none", borderRight: "none", textAlign: "left" }}>{label}</td>
            <td style={{ borderBottom: "1px solid black", borderLeft: "none", borderRight: "none", textAlign: "right" }}>{String(value)} </td>
          </tr>)}
        </tbody></table>
      </div>
      <div className="flex justify-center py-1"><QRCodeSVG size={120} value={bankLink.url} level="L" title="Open the original bank receipt" /></div>
      <div className="flex justify-center"><p>Scan the QR to open the bank receipt</p></div>
      <div className="flex justify-center"><button type="button" data-download-pdf="true" data-html2canvas-ignore="true" className="my-1 bg-[#f1ab15] py-0.5 px-20">Download PDF</button></div>
      <div className="p-3 border-b-4 border-[#f1ab15] mx-auto"><div className="flex justify-center">
        <div className="flex items-center"><h2 className="md:px-2 px-2"><CiPhone /></h2><h2 className="md:px-2 text-left">8397</h2></div>
        <div className="flex items-center"><h2 className="md:px-2 px-2"><AiTwotoneMail /></h2><h2 className="md:px-2 text-left">Contactcenter</h2></div>
        <div className="flex items-center"><h2 className="md:px-2 px-2"><img src={`${assets}/swift.png`} width={15} alt="SWIFT" /></h2><h2 className="md:px-2 text-left">ABYSETAA</h2></div>
      </div></div>
      <div className="w-2/4 flex justify-between mx-auto my-4">
        {socials.map(([name, href, Icon, color]) => <a key={name} href={href} target="_blank" rel="noopener noreferrer" aria-label={name}><Icon color={color} /></a>)}
      </div>
      <p className="receipt-copy-note">{provenance} QR opens the bank website; this copy is not bank verification.</p>
    </div></div></body></html>
  );
  return `<!doctype html>${markup}`;
}

export default function BoaReceiptViewer({ transaction, bankLink, onClose }) {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);
  const pdfPendingRef = useRef(false);
  const [bankData, setBankData] = useState(() => receiptCache.get(bankLink.token) || null);
  const [status, setStatus] = useState(() => receiptCache.has(bankLink.token) ? "bank" : "loading");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusedElement = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      focusedElement?.focus();
    };
  }, []);

  useEffect(() => {
    if (receiptCache.has(bankLink.token)) return;
    const controller = new AbortController();
    // Includes a cold backend start. Saved details remain usable throughout.
    const timeout = setTimeout(() => controller.abort(), 6000);
    let active = true;
    async function load() {
      try {
        const response = await fetch(`${API_URL}/receipt-details?trx=${encodeURIComponent(bankLink.token)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Receipt unavailable");
        const payload = await response.json();
        if (payload.token !== bankLink.token || typeof payload.data?.["Transaction Reference"] !== "string" || !bankLink.token.startsWith(payload.data["Transaction Reference"])) throw new Error("Receipt mismatch");
        if (!active) return;
        if (receiptCache.size >= 100) receiptCache.delete(receiptCache.keys().next().value);
        receiptCache.set(bankLink.token, payload.data);
        setBankData(payload.data);
        setStatus("bank");
      } catch {
        if (active) setStatus("saved");
      } finally {
        clearTimeout(timeout);
      }
    }
    load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [bankLink.token]);

  async function downloadPdf() {
    if (pdfPendingRef.current) return;
    pdfPendingRef.current = true;
    setPdfBusy(true);
    setPdfError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const doc = frameRef.current.contentDocument;
      await Promise.all(Array.from(doc.images).map(img => img.decode().catch(() => {})));
      // Capture in the iframe's own document so bank CSS is preserved instead
      // of cloning the receipt into the dashboard's differently styled DOM.
      const canvas = await html2canvas(doc.getElementById("invoice"), { scale: 2, backgroundColor: "#fff", logging: false });
      const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
      const margin = 0.35;
      const width = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const pixelsPerPage = Math.floor(pageHeight * canvas.width / width);
      // Crop each page separately so long receipts stay inside page margins.
      for (let offset = 0; offset < canvas.height; offset += pixelsPerPage) {
        if (offset) pdf.addPage();
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = Math.min(pixelsPerPage, canvas.height - offset);
        slice.getContext("2d").drawImage(canvas, 0, offset, canvas.width, slice.height, 0, 0, slice.width, slice.height);
        pdf.addImage(slice.toDataURL("image/jpeg", 0.98), "JPEG", margin, margin, width, slice.height * width / slice.width);
      }
      pdf.save(`BOA-Receipt-${bankLink.token}-copy.pdf`);
    } catch {
      setPdfError("Could not download PDF. Use Print / Save PDF instead.");
    } finally {
      pdfPendingRef.current = false;
      setPdfBusy(false);
    }
  }

  const rows = bankData ? bankReceiptRows(bankData) : savedReceiptRows(transaction);
  // Render outside the desktop table's 0.75 zoom so the bank template keeps
  // its original font sizes and iframe pointer coordinates remain accurate.
  return createPortal(
    <dialog ref={dialogRef} className="boa-viewer" aria-labelledby="boa-viewer-title" onCancel={onClose}
      onClick={event => { if (event.target === dialogRef.current) onClose(); }}>
      <div className="boa-viewer-panel">
        <header className="boa-viewer-toolbar">
          <h2 id="boa-viewer-title">Receipt</h2>
          <a href={bankLink.url} target="_blank" rel="noopener noreferrer">Open bank receipt{bankLink.corrected ? " (corrected link)" : ""}</a>
          <button type="button" onClick={() => frameRef.current?.contentWindow?.print()}>Print / Save PDF</button>
          <button type="button" onClick={onClose} aria-label="Close receipt" autoFocus>Close</button>
        </header>
        <p className="boa-viewer-status" role="status">
          {status === "bank" ? "Bank Tracker copy · Details loaded from the bank." : status === "loading" ? "Saved copy is ready. Checking for full bank details…" : "Bank receipt unavailable. Showing saved transaction details."}
          {pdfBusy ? " Preparing PDF…" : ""}{pdfError ? ` ${pdfError}` : ""}
        </p>
        <iframe ref={frameRef} title="Bank of Abyssinia receipt copy" sandbox="allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox"
          srcDoc={receiptDocument(rows, bankLink, !!bankData)}
          onLoad={() => {
            const doc = frameRef.current?.contentDocument;
            const button = doc?.querySelector("[data-download-pdf]");
            if (button) button.onclick = downloadPdf;
            doc?.addEventListener("keydown", event => { if (event.key === "Escape") onClose(); });
          }} />
      </div>
    </dialog>, document.body
  );
}
