import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaCamera,
  FaCheck,
  FaClock,
  FaMapMarkerAlt,
  FaReceipt,
  FaRedo,
  FaStopwatch,
  FaUpload
} from "react-icons/fa";
import {
  calculateParkingCharge,
  extractParkingDateTime,
  formatParkingDateTime,
  formatParkingDuration,
  PARKING_RATE_PER_HOUR,
  parseParkingDateTime
} from "./parkingReceipt";

const SUCCESS_SPARKS = Array.from({ length: 12 });

export default function ParkingReceiptFlow({
  parkingDraft,
  setParkingDraft,
  onSave,
  saving,
  saveSuccess
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const mountedRef = useRef(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanStatus, setScanStatus] = useState("Aim at the printed date and time on the ticket.");
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    mountedRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const entryDate = useMemo(
    () => parseParkingDateTime(parkingDraft.date),
    [parkingDraft.date]
  );
  const charge = useMemo(
    () => calculateParkingCharge(entryDate, now),
    [entryDate, now]
  );
  const amountText = charge.amount.toFixed(2);

  useEffect(() => {
    if (charge.error || parkingDraft.amount === amountText) return;
    setParkingDraft((current) => ({
      ...current,
      amount: amountText,
      narrative: "Abrihot"
    }));
  }, [amountText, charge.error, parkingDraft.amount, setParkingDraft]);

  const replacePreview = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const scanReceipt = async (file) => {
    if (!file) return;

    replacePreview(file);
    setScanning(true);
    setScanProgress(0);
    setScanStatus("Reading only the ticket date and time...");

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (message) => {
          if (mountedRef.current && message.status === "recognizing text" && typeof message.progress === "number") {
            setScanProgress(Math.round(message.progress * 100));
          }
        }
      });
      if (!mountedRef.current) return;
      const detectedDate = extractParkingDateTime(result.data.text || "");

      if (!detectedDate) {
        setScanStatus("I couldn't find the date line. Retake the photo or type it below.");
        return;
      }

      const scannedEntry = parseParkingDateTime(detectedDate);
      const scanTime = new Date();
      const looksLikeMisreadDay =
        scannedEntry > scanTime &&
        scannedEntry.getMonth() === scanTime.getMonth() &&
        scannedEntry.getFullYear() === scanTime.getFullYear();
      const verifiedDate = looksLikeMisreadDay
        ? formatParkingDateTime(new Date(
            scanTime.getFullYear(),
            scanTime.getMonth(),
            scanTime.getDate(),
            scannedEntry.getHours(),
            scannedEntry.getMinutes(),
            scannedEntry.getSeconds()
          ))
        : detectedDate;

      setParkingDraft((current) => ({
        ...current,
        date: verifiedDate,
        narrative: "Abrihot"
      }));
      setScanStatus(looksLikeMisreadDay
        ? "The day was unclear, so I used today. Please check it against the ticket."
        : "Entry time found. Please check it before saving.");
    } catch (error) {
      console.error("PARKING RECEIPT OCR ERROR:", error);
      if (mountedRef.current) {
        setScanStatus("The receipt could not be read. Retake the photo or enter the time manually.");
      }
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  };

  const startCamera = async () => {
    stopCamera();
    setScanStatus("Opening camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOpen(true);
      window.requestAnimationFrame(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanStatus("Keep the date line inside the frame, then capture.");
      });
    } catch (error) {
      console.error("PARKING CAMERA ERROR:", error);
      setScanStatus("Camera is unavailable. Use the photo button instead.");
    }
  };

  const captureReceipt = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video?.videoWidth || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      scanReceipt(new File([blob], "abrihot-parking.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  const resetScan = () => {
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setScanProgress(0);
    setScanStatus("Aim at the printed date and time on the ticket.");
    setParkingDraft({ amount: "", date: "", reference: "", narrative: "Abrihot" });
  };

  const canSave = !scanning && !saving && !charge.error && charge.amount > 0;

  return (
    <div className="parking-flow">
      <section className="parking-camera-card" aria-label="Parking receipt camera">
        <div className="parking-section-heading">
          <div className="parking-heading-icon"><FaCamera /></div>
          <div>
            <span className="parking-eyebrow">Receipt camera</span>
            <h3>Scan your entry time</h3>
          </div>
          <span className="parking-location-chip"><FaMapMarkerAlt /> Abrihot</span>
        </div>

        <div className={`parking-camera-stage ${cameraOpen ? "is-live" : ""}`}>
          {cameraOpen ? (
            <video ref={videoRef} playsInline muted aria-label="Live parking receipt camera" />
          ) : previewUrl ? (
            <img src={previewUrl} alt="Captured Abrihot parking receipt" />
          ) : (
            <div className="parking-camera-placeholder">
              <FaReceipt />
              <strong>Place the receipt in view</strong>
              <span>Only the printed date and time are read.</span>
            </div>
          )}
          <div className="parking-scan-line" aria-hidden="true"></div>
          <div className="parking-date-guide" aria-hidden="true"><span>Date / time line</span></div>
          {scanning && (
            <div className="parking-reading-overlay">
              <div className="parking-reading-ring"></div>
              <strong>Reading receipt</strong>
              <span>{scanProgress}%</span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} hidden></canvas>
        <input
          ref={fileInputRef}
          className="parking-file-input"
          type="file"
          accept="image/*"
          onChange={(event) => {
            scanReceipt(event.target.files?.[0]);
            event.target.value = "";
          }}
          disabled={scanning || saving}
        />

        <div className="parking-camera-actions">
          {cameraOpen ? (
            <button type="button" className="parking-capture-btn" onClick={captureReceipt}>
              <span></span> Capture receipt
            </button>
          ) : (
            <>
              <button type="button" className="parking-camera-btn" onClick={startCamera} disabled={scanning || saving}>
                <FaCamera /> Open camera
              </button>
              <button type="button" className="parking-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={scanning || saving}>
                <FaUpload /> Choose from gallery
              </button>
            </>
          )}
          {previewUrl && !scanning && (
            <button type="button" className="parking-reset-btn" onClick={resetScan} disabled={saving}>
              <FaRedo /> Retake
            </button>
          )}
        </div>

        <p className={`parking-scan-status ${parkingDraft.date ? "is-found" : ""}`} aria-live="polite">
          {parkingDraft.date && <FaCheck />} {scanStatus}
        </p>
      </section>

      <section className="parking-calculation-card">
        <div className="parking-section-heading compact">
          <div className="parking-heading-icon warm"><FaStopwatch /></div>
          <div>
            <span className="parking-eyebrow">Live calculation</span>
            <h3>{PARKING_RATE_PER_HOUR} ETB per hour</h3>
          </div>
          <span className="parking-rate-note">Prorated by minute</span>
        </div>

        <label className="parking-entry-field">
          <span><FaClock /> Entry date & time</span>
          <input
            type="text"
            value={parkingDraft.date}
            onChange={(event) => setParkingDraft((current) => ({ ...current, date: event.target.value }))}
            placeholder="DD/MM/YYYY HH:MM:SS"
            disabled={saving}
          />
          <small>Check the scan against the ticket before saving.</small>
        </label>

        <div className="parking-price-summary">
          <div>
            <span>Time parked</span>
            <strong>{charge.error ? "—" : formatParkingDuration(charge.elapsedMinutes)}</strong>
          </div>
          <div className="parking-price-divider" aria-hidden="true"></div>
          <div className="parking-total">
            <span>Amount to pay</span>
            <strong><b>{charge.error ? "0.00" : amountText}</b> ETB</strong>
          </div>
        </div>

        {charge.error ? (
          <p className="parking-calculation-error" role="alert">{charge.error}</p>
        ) : (
          <p className="parking-formula">{formatParkingDuration(charge.elapsedMinutes)} × {PARKING_RATE_PER_HOUR} ETB/hour</p>
        )}

        <button type="button" className="parking-save-btn" onClick={onSave} disabled={!canSave}>
          {saving ? (
            <><span className="parking-button-spinner"></span> Saving parking...</>
          ) : (
            <><FaCheck /> Save & add {amountText} ETB</>
          )}
        </button>
      </section>

      {saveSuccess && (
        <div className="parking-success" role="status" aria-live="polite">
          <div className="parking-success-sparks" aria-hidden="true">
            {SUCCESS_SPARKS.map((_, index) => <i key={index}></i>)}
          </div>
          <div className="parking-success-check"><FaCheck /></div>
          <span>Parking saved</span>
          <h3>{amountText} ETB added</h3>
          <p>Abrihot · {formatParkingDuration(charge.elapsedMinutes)}</p>
        </div>
      )}
    </div>
  );
}
