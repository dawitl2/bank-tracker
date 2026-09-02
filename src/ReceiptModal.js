import { FaArrowLeft, FaCar, FaImage, FaLink, FaQrcode, FaTimes } from "react-icons/fa";
import ParkingReceiptFlow from "./ParkingReceiptFlow";

const GENERATED_TRANSACTION_FIELDS = ["id", "created_at"];

export default function ReceiptModal({
  showModal,
  receiptDraft,
  receiptMode,
  setReceiptMode,
  openParkingModal,
  url,
  setUrl,
  scrapeLoading,
  draftSaving,
  handleScrape,
  cameraDevices,
  selectedCameraId,
  setSelectedCameraId,
  startQrScanner,
  videoRef,
  zoomRange,
  cameraZoom,
  applyCameraZoom,
  qrStatus,
  imageStatus,
  imageProgress,
  handleImageReceipt,
  parkingDraft,
  setParkingDraft,
  handleParkingDraftSubmit,
  parkingSaveSuccess,
  personOptions,
  handleDraftChange,
  handleSaveDraft,
  stopQrScanner,
  setQrStatus,
  handleCloseModal
}) {
  if (!showModal) return null;

  const goBack = () => {
    stopQrScanner();
    setReceiptMode(null);
    setQrStatus("");
  };

  return (
    <div className="modal-overlay receipt-modal-overlay">
      <div className={`modal receipt-modal ${receiptMode === "parking" ? "parking-modal" : ""}`}>
        <div className="receipt-modal-title-row">
          <div className="receipt-modal-title-copy">
            <span>{receiptMode === "parking" ? "Abrihot Library · Dave" : "Bank tracker"}</span>
            <h2>{receiptDraft?.id ? "Edit transaction" : receiptMode === "parking" ? "Add parking payment" : "Add receipt"}</h2>
          </div>
          <div className="receipt-modal-header-actions">
            {!receiptDraft && receiptMode === "parking" && (
              <button type="button" className="receipt-modal-icon-button" onClick={goBack} aria-label="Back to receipt options">
                <FaArrowLeft />
              </button>
            )}
            <button type="button" className="receipt-modal-icon-button" onClick={handleCloseModal} aria-label="Close">
              <FaTimes />
            </button>
          </div>
        </div>

        {!receiptDraft && !receiptMode && (
          <div className="receipt-choice-grid">
            <button className="receipt-choice-card" onClick={() => setReceiptMode("link")}>
              <div className="receipt-choice-details"><span>Link</span><small>Paste a receipt link</small></div>
              <FaLink className="receipt-choice-icon" />
            </button>
            <button className="receipt-choice-card" onClick={() => setReceiptMode("qr")}>
              <div className="receipt-choice-details"><span>QR</span><small>Scan from camera</small></div>
              <FaQrcode className="receipt-choice-icon" />
            </button>
            <button className="receipt-choice-card" onClick={() => setReceiptMode("image")}>
              <div className="receipt-choice-details"><span>Image</span><small>Read a screenshot</small></div>
              <FaImage className="receipt-choice-icon" />
            </button>
            <button className="receipt-choice-card parking-choice-card" onClick={openParkingModal}>
              <div className="receipt-choice-details">
                <span>Parking</span>
                <small>Scan an Abrihot ticket (<span className="parking-dave-label">Dave</span>)</small>
              </div>
              <FaCar className="receipt-choice-icon" />
            </button>
          </div>
        )}

        {!receiptDraft?.id && receiptMode === "link" && (
          <input
            type="text"
            placeholder="Paste receipt link..."
            value={url}
            disabled={scrapeLoading || draftSaving}
            onChange={(event) => setUrl(event.target.value)}
          />
        )}

        {!receiptDraft && receiptMode === "qr" && (
          <div className="qr-scanner-panel">
            {cameraDevices.length > 1 && (
              <label className="qr-control-field">
                <span>Camera</span>
                <select
                  value={selectedCameraId}
                  onChange={(event) => {
                    setSelectedCameraId(event.target.value);
                    startQrScanner(event.target.value, false);
                  }}
                >
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <video ref={videoRef} className="qr-video" playsInline muted></video>
            {zoomRange && (
              <label className="qr-control-field">
                <span>Zoom {cameraZoom.toFixed(1)}x</span>
                <input
                  type="range"
                  min={zoomRange.min}
                  max={zoomRange.max}
                  step={zoomRange.step}
                  value={cameraZoom}
                  onChange={(event) => applyCameraZoom(event.target.value)}
                />
              </label>
            )}
            <p>{qrStatus || "Preparing camera..."}</p>
          </div>
        )}

        {!receiptDraft && receiptMode === "image" && (
          <div className="image-receipt-panel">
            <input type="file" accept="image/*" onChange={handleImageReceipt} disabled={scrapeLoading || draftSaving} />
            <p>{imageStatus ? `${imageStatus}${imageProgress ? ` ${imageProgress}%` : ""}` : "Choose a clear receipt screenshot."}</p>
          </div>
        )}

        {!receiptDraft && receiptMode === "parking" && (
          <ParkingReceiptFlow
            parkingDraft={parkingDraft}
            setParkingDraft={setParkingDraft}
            onSave={handleParkingDraftSubmit}
            saving={draftSaving}
            saveSuccess={parkingSaveSuccess}
          />
        )}

        {receiptDraft && (
          <div className="receipt-draft-box">
            <h3>Review Receipt</h3>
            <div className="receipt-draft-grid">
              {Object.entries(receiptDraft)
                .filter(([field]) => !GENERATED_TRANSACTION_FIELDS.includes(field))
                .map(([field, value]) => (
                  <label key={field} className="draft-field">
                    <span>{field}</span>
                    {field === "person" ? (
                      <select value={value ?? "null"} onChange={(event) => handleDraftChange(field, event.target.value)}>
                        {personOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : typeof value === "boolean" ? (
                      <select value={String(value)} onChange={(event) => handleDraftChange(field, event.target.value)}>
                        <option value="true">true</option><option value="false">false</option>
                      </select>
                    ) : value === null ? (
                      <input type="text" value="null" onChange={(event) => handleDraftChange(field, event.target.value)} />
                    ) : (
                      <input type="text" value={value ?? ""} onChange={(event) => handleDraftChange(field, event.target.value)} />
                    )}
                  </label>
                ))}
            </div>
          </div>
        )}

        {!parkingSaveSuccess && receiptMode !== "parking" && (receiptDraft || receiptMode) && (
          <div className="modal-buttons receipt-modal-actions">
            {!receiptDraft?.id && receiptMode === "link" && (
              <button className="scrape-btn" onClick={() => handleScrape()} disabled={scrapeLoading || draftSaving}>
                {receiptDraft ? "Scrape Again" : "Scrape"}
              </button>
            )}
            {!receiptDraft && receiptMode && (
              <button className="close-btn" onClick={goBack} disabled={scrapeLoading || draftSaving}>Back</button>
            )}
            {receiptDraft && (
              <button className="save-draft-btn" onClick={handleSaveDraft} disabled={draftSaving}>
                {draftSaving ? "Saving..." : receiptDraft.id ? "Save Changes" : "Approve & Save"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
