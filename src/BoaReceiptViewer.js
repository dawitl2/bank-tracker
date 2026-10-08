import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { FaFacebookF, FaInstagram, FaLinkedin, FaTiktok, FaYoutube } from "react-icons/fa";
import { AiTwotoneMail } from "react-icons/ai";
import { CiPhone } from "react-icons/ci";
import { FaTelegramPlane } from "react-icons/fa";
import { getBoaReceiptLink, readSavedReceipt, savedReceiptRows } from "./boaReceipt";
import "./BoaReceiptViewer.css";

const API_URL = process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";
const socials = [
  ["Facebook", "https://www.facebook.com/BoAeth/", FaFacebookF, "#1877F2"],
  ["YouTube", "https://www.youtube.com/@abyssinia_bank", FaYoutube, "#c4302b"],
  ["Telegram", "https://t.me/BoAEth", FaTelegramPlane, "#0088cc"],
  ["LinkedIn", "https://www.linkedin.com/company/bankofabyssinia/", FaLinkedin, "#0e76a8"],
  ["Instagram", "https://www.instagram.com/abyssinia_bank", FaInstagram],
  ["TikTok", "https://www.tiktok.com/@abyssinia_bank", FaTiktok]
];

function receiptDocument(rows, bankLink) {
  const assets = `${window.location.origin}${process.env.PUBLIC_URL || ""}/boa-receipt`;
  const markup = renderToStaticMarkup(
    <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Receipt</title><link rel="stylesheet" href={`${assets}/bank.css`} />
      <style>{`body{background:#fff;color:#000}td{overflow-wrap:anywhere}button:focus-visible,a:focus-visible{outline:2px solid #000;outline-offset:3px}@media print{[data-download-pdf]{display:none}#root{padding:1rem}}`}</style>
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
    </div></div></body></html>
  );
  return `<!doctype html>${markup}`;
}

export default function BoaReceiptViewer() {
  const frameRef = useRef(null);
  const pdfPendingRef = useRef(false);
  const [pdfError, setPdfError] = useState("");
  const [failed, setFailed] = useState(false);
  const token = new URLSearchParams(window.location.search).get("trx");
  const bankLink = getBoaReceiptLink(`https://cs.bankofabyssinia.com/slip/?trx=${encodeURIComponent(token || "")}`);
  const bankToken = bankLink?.token;
  const [transaction] = useState(() => bankLink ? readSavedReceipt(bankLink.token) : null);

  useEffect(() => {
    document.title = "Receipt";
    if (!bankToken) return undefined;
    const timeout = setTimeout(() => setFailed(true), 30000);
    const receive = event => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== new URL(API_URL).origin || event.data?.token !== bankToken) return;
      if (event.data.type === "boa-receipt-ready") clearTimeout(timeout);
      if (event.data.type === "boa-receipt-failed") {
        clearTimeout(timeout);
        setFailed(true);
      }
    };
    window.addEventListener("message", receive);
    return () => { clearTimeout(timeout); window.removeEventListener("message", receive); };
  }, [bankToken]);

  async function downloadPdf() {
    if (pdfPendingRef.current) return;
    pdfPendingRef.current = true;
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
      setPdfError("Could not download PDF. Please try again.");
    } finally {
      pdfPendingRef.current = false;
    }
  }


  if (!bankLink) return <main className="receipt-empty">Receipt not found.</main>;
  const fallback = failed;
  return <main className="boa-receipt-page">
    {pdfError && <p role="alert" className="receipt-pdf-error">{pdfError}</p>}
    <iframe key={fallback ? "saved" : "bank"} ref={frameRef} title="Receipt"
      sandbox="allow-scripts allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      src={fallback ? undefined : `${API_URL}/receipt-page?trx=${encodeURIComponent(bankLink.token)}`}
      srcDoc={fallback ? receiptDocument(savedReceiptRows(transaction || {}), bankLink) : undefined}
      onError={() => setFailed(true)}
      onLoad={() => {
        if (!fallback) return;
        const button = frameRef.current?.contentDocument?.querySelector("[data-download-pdf]");
        if (button) button.onclick = downloadPdf;
      }} />
  </main>;
}
