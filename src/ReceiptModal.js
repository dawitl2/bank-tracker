import { LocalizedTextInput, useLanguage } from "./Language";
import { useEffect, useState } from "react";
import { FaArrowLeft, FaTimes } from "react-icons/fa";
import { FiChevronRight, FiLink, FiGrid, FiImage, FiTruck } from "react-icons/fi";
import ParkingReceiptFlow from "./ParkingReceiptFlow";
import TransactionDateField from "./TransactionDateField";
import { formatTransactionAmount } from "./transactionAmount";

const GENERATED_TRANSACTION_FIELDS = ["id", "created_at", "source_sms_hash"];

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
  const { t } = useLanguage();
  const [imageFileName, setImageFileName] = useState("");

  useEffect(() => {
    if (receiptMode !== "image") setImageFileName("");
  }, [receiptMode]);

  if (!showModal) return null;

  const goBack = () => {
    stopQrScanner();
    setReceiptMode(null);
    setQrStatus("");
  };

  return (
    <div className="modal-overlay receipt-modal-overlay">
      <div className={`modal receipt-modal${!receiptDraft && !receiptMode ? " receipt-picker" : ""} ${receiptMode === "parking" ? "parking-modal" : ""}`}>
        <div className="receipt-modal-title-row">
          <div className="receipt-modal-title-copy">
            <span>{t(receiptMode === "parking" ? "Abrihot Library" : "Bank tracker")}</span>
            <h2>{t(receiptDraft?.id ? "Edit transaction" : receiptMode === "parking" ? "Add parking payment" : "Add receipt")}</h2>
            {!receiptDraft && !receiptMode && <p>{t("Choose how to add your receipt.")}</p>}
          </div>
          <div className="receipt-modal-header-actions">
            {!receiptDraft && receiptMode === "parking" && (
              <button type="button" className="receipt-modal-icon-button" onClick={goBack} aria-label={t("Back to receipt options")} disabled={scrapeLoading || draftSaving}>
                <FaArrowLeft />
              </button>
            )}
            <button type="button" className="receipt-modal-icon-button" onClick={handleCloseModal} aria-label={t("Close")} disabled={scrapeLoading || draftSaving}>
              <FaTimes />
            </button>
          </div>
        </div>

        {!receiptDraft && !receiptMode && (
          <div className="receipt-choice-grid">
            <button className="receipt-choice-card" onClick={() => setReceiptMode("link")}>
              <div className="receipt-choice-details"><span>{t("Link")}</span><small>{t("Paste a receipt link")}</small></div>
              <span className="receipt-choice-mark"><FiLink aria-hidden="true" /></span><FiChevronRight className="receipt-choice-arrow" aria-hidden="true" />
            </button>
            <button className="receipt-choice-card" onClick={() => setReceiptMode("qr")}>
              <div className="receipt-choice-details"><span>{t("QR")}</span><small>{t("Scan from camera")}</small></div>
              <span className="receipt-choice-mark"><FiGrid aria-hidden="true" /></span><FiChevronRight className="receipt-choice-arrow" aria-hidden="true" />
            </button>
            <button className="receipt-choice-card" onClick={() => setReceiptMode("image")}>
              <div className="receipt-choice-details"><span>{t("Image")}</span><small>{t("Read a screenshot")}</small></div>
              <span className="receipt-choice-mark"><FiImage aria-hidden="true" /></span><FiChevronRight className="receipt-choice-arrow" aria-hidden="true" />
            </button>
            <button className="receipt-choice-card parking-choice-card" onClick={openParkingModal}>
              <div className="receipt-choice-details">
                <span>{t("Parking")}</span>
                <small>{t("Scan an Abrihot ticket")}</small>
              </div>
              <span className="receipt-choice-mark"><FiTruck aria-hidden="true" /></span><FiChevronRight className="receipt-choice-arrow" aria-hidden="true" />
            </button>
          </div>
        )}

        {!receiptDraft?.id && receiptMode === "link" && (
          <input
            type="text"
            placeholder={t("Paste receipt link...")}
            value={url}
            disabled={scrapeLoading || draftSaving}
            onChange={(event) => setUrl(event.target.value)}
          />
        )}

        {!receiptDraft && receiptMode === "qr" && (
          <div className="qr-scanner-panel">
            {cameraDevices.length > 1 && (
              <label className="qr-control-field qr-zoom-field">
                <span>{t("Camera")}</span>
                <select
                  value={selectedCameraId}
                  onChange={(event) => {
                    setSelectedCameraId(event.target.value);
                    startQrScanner(event.target.value, false);
                  }}
                >
                  {cameraDevices.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {t(device.label || `Camera ${index + 1}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <video ref={videoRef} className="qr-video" playsInline muted></video>
            {zoomRange && (
              <label className="qr-control-field">
                <span>{t("Zoom ")}{t(cameraZoom.toFixed(1))}{t("x")}</span>
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
            <p>{t(qrStatus || "Preparing camera...")}</p>
          </div>
        )}

        {!receiptDraft && receiptMode === "image" && (
          <div className="image-receipt-panel">
            <label className="image-receipt-upload">
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setImageFileName(event.target.files?.[0]?.name || "");
                  handleImageReceipt(event);
                }}
                disabled={scrapeLoading || draftSaving}
              />
              <span className="image-upload-icon"><FiImage /></span>
              <span className="image-upload-copy">
                <strong>{t(imageFileName || "Choose receipt image")}</strong>
                <small>{t("JPG, PNG or a screenshot")}</small>
              </span>
              <span className="image-upload-action">{t("Browse")}</span>
            </label>
            <div className={`image-receipt-status ${scrapeLoading ? "is-reading" : ""}`}>
              <span>{t(imageStatus ? `${imageStatus}${imageProgress ? ` ${imageProgress}%` : ""}` : "Use a clear image with the full receipt visible.")}</span>
              {scrapeLoading && <div className="image-receipt-progress"><i style={{ width: `${imageProgress}%` }}></i></div>}
            </div>
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
            <h3>{t("Review Receipt")}</h3>
            <div className="receipt-draft-grid">
              {Object.entries(receiptDraft)
                .filter(([field]) => !GENERATED_TRANSACTION_FIELDS.includes(field))
                .map(([field, value]) => (
                  <label key={field} className="draft-field">
                    <span>{t(field)}</span>
                    {field === "amount" ? (
                      <input type="text" inputMode="numeric" value={formatTransactionAmount(value)} disabled={draftSaving}
                        onChange={(event) => handleDraftChange(field, event.target.value.replace(/,/g, "").split(".")[0])} />
                    ) : field === "date" && receiptDraft.id ? (
                      <TransactionDateField value={value} disabled={draftSaving} onChange={next => handleDraftChange(field, next)} />
                    ) : field === "person" ? (
                      <select value={value ?? "null"} onChange={(event) => handleDraftChange(field, event.target.value)}>
                        {personOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
                      </select>
                    ) : typeof value === "boolean" ? (
                      <select value={String(value)} onChange={(event) => handleDraftChange(field, event.target.value)}>
                        <option value="true">{t(field === "is_withdraw" ? "Withdrawal" : "Yes")}</option><option value="false">{t(field === "is_withdraw" ? "Deposit" : "No")}</option>
                      </select>
                    ) : field === "narrative" ? (
                      <LocalizedTextInput type="text" value={value ?? ""} disabled={draftSaving} onChange={(event) => handleDraftChange(field, event.target.value)} />
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
                {t(receiptDraft ? "Scrape Again" : "Scrape")}
              </button>
            )}
            {!receiptDraft && receiptMode && (
              <button className="close-btn" onClick={goBack} disabled={scrapeLoading || draftSaving}>{t("Back")}</button>
            )}
            {receiptDraft && (
              <button className="save-draft-btn" onClick={handleSaveDraft} disabled={draftSaving}>
                {t(draftSaving ? "Saving..." : receiptDraft.id ? "Save Changes" : "Approve & Save")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
