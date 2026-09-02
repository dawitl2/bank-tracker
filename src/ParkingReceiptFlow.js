import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCamera, FaCheck, FaClock, FaRedo, FaUpload } from "react-icons/fa";
import {
  calculateParkingCharge,
  extractParkingTimestamp,
  formatParkingDateTime,
  formatParkingDuration,
  PARKING_RATE_PER_HOUR,
  parseParkingDateTime
} from "./parkingReceipt";

const createImageElement = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Could not open receipt image."));
  };
  image.src = objectUrl;
});

const prepareReceiptForOcr = async (file) => {
  const source = typeof createImageBitmap === "function"
    ? await createImageBitmap(file)
    : await createImageElement(file);
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const cropX = Math.round(sourceWidth * 0.08);
  const cropY = Math.round(sourceHeight * 0.5);
  const cropWidth = Math.round(sourceWidth * 0.84);
  const cropHeight = Math.round(sourceHeight * 0.34);
  const scale = Math.min(2.25, 1600 / cropWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropWidth * scale);
  canvas.height = Math.round(cropHeight * scale);
  const context = canvas.getContext("2d");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "grayscale(1) contrast(1.8) brightness(1.08)";
  context.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  if (typeof source.close === "function") source.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not prepare receipt image.")),
      "image/jpeg",
      0.96
    );
  });
};

export default function ParkingReceiptFlow({
  parkingDraft,
  setParkingDraft,
  onSave,
  saving,
  saveSuccess
}) {
  const videoRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const previewUrlRef = useRef("");
  const mountedRef = useRef(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [scanState, setScanState] = useState("idle");
  const [scanMessage, setScanMessage] = useState("");
  const [scanProgress, setScanProgress] = useState(0);
  const [entryMode, setEntryMode] = useState("scan");
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
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
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const entryDate = useMemo(() => parseParkingDateTime(parkingDraft.date), [parkingDraft.date]);
  const charge = useMemo(() => calculateParkingCharge(entryDate, now), [entryDate, now]);
  const enteredDurationMinutes =
    (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0);
  const durationAmount = Math.round((enteredDurationMinutes / 60) * PARKING_RATE_PER_HOUR * 100) / 100;
  const amountText = entryMode === "duration" ? durationAmount.toFixed(2) : charge.amount.toFixed(2);

  useEffect(() => {
    if (entryMode !== "scan" || charge.error || parkingDraft.amount === amountText) return;
    setParkingDraft((current) => ({ ...current, amount: amountText, narrative: "Abrihot" }));
  }, [amountText, charge.error, entryMode, parkingDraft.amount, setParkingDraft]);

  useEffect(() => {
    if (entryMode !== "duration") return;
    const durationReference = `${Number(durationHours) || 0}h ${Number(durationMinutes) || 0}m`;
    setParkingDraft((current) => ({
      ...current,
      amount: enteredDurationMinutes > 0 ? amountText : "",
      date: current.date || formatParkingDateTime(new Date()),
      reference: durationReference,
      narrative: "Abrihot"
    }));
  }, [amountText, durationHours, durationMinutes, enteredDurationMinutes, entryMode, setParkingDraft]);

  const replacePreview = (file) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const scanReceipt = async (file) => {
    if (!file) return;
    replacePreview(file);
    setScanState("reading");
    setScanMessage("Reading the entry time...");
    setScanProgress(0);

    let worker;
    try {
      const [preparedImage, tesseract] = await Promise.all([
        prepareReceiptForOcr(file).catch(() => file),
        import("tesseract.js")
      ]);
      worker = await tesseract.createWorker("eng", 1, {
        logger: (message) => {
          if (mountedRef.current && message.status === "recognizing text") {
            setScanProgress(Math.round((message.progress || 0) * 100));
          }
        }
      });
      await worker.setParameters({
        tessedit_pageseg_mode: "6",
        preserve_interword_spaces: "1"
      });

      let result = await worker.recognize(preparedImage);
      let detected = extractParkingTimestamp(result.data.text || "", new Date());

      // A wider second pass handles photos where the ticket is not centered.
      if (!detected.date) {
        result = await worker.recognize(file);
        detected = extractParkingTimestamp(result.data.text || "", new Date());
      }
      if (!mountedRef.current) return;

      if (!detected.date) {
        setScanState("error");
        setScanMessage("Time not found. Try another photo.");
        return;
      }

      setParkingDraft((current) => ({
        ...current,
        date: detected.date,
        narrative: "Abrihot"
      }));
      setScanState("success");
      setScanMessage(detected.usedTodayFallback
        ? "Time found. Date set to today—please check it."
        : "Entry time found.");
    } catch (error) {
      console.error("PARKING RECEIPT OCR ERROR:", error);
      if (mountedRef.current) {
        setScanState("error");
        setScanMessage("The photo could not be read. Try another photo.");
      }
    } finally {
      if (worker) await worker.terminate();
    }
  };

  const startCamera = async () => {
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera API unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
      });
    } catch (error) {
      console.error("PARKING CAMERA ERROR:", error);
      setScanState("error");
      setScanMessage("Camera unavailable. Choose a photo from the gallery instead.");
    }
  };

  const captureReceipt = () => {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video?.videoWidth || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      scanReceipt(new File([blob], "abrihot-parking.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.94);
  };

  const resetScan = () => {
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setScanState("idle");
    setScanMessage("");
    setScanProgress(0);
    setParkingDraft({ amount: "", date: "", reference: "", narrative: "Abrihot" });
  };

  const changeEntryMode = (nextMode) => {
    stopCamera();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setScanState("idle");
    setScanMessage("");
    setScanProgress(0);
    setDurationHours("");
    setDurationMinutes("");
    setParkingDraft({
      amount: "",
      date: nextMode === "duration" ? formatParkingDateTime(new Date()) : "",
      reference: "",
      narrative: "Abrihot"
    });
    setEntryMode(nextMode);
  };

  if (saveSuccess) {
    return (
      <div className="parking-success" role="status" aria-live="polite">
        <span className="parking-success-check"><FaCheck /></span>
        <div><strong>Parking saved</strong><small>{amountText} ETB added · Abrihot</small></div>
      </div>
    );
  }

  const canSave = entryMode === "duration"
    ? !saving && enteredDurationMinutes > 0
    : scanState !== "reading" && !saving && !charge.error && charge.amount > 0;

  return (
    <div className="parking-flow">
      <div className="parking-context-row">
        <span>Abrihot Library</span>
        <span>{PARKING_RATE_PER_HOUR} ETB / hour</span>
      </div>

      <div className="parking-mode-toggle" role="group" aria-label="Parking entry method">
        <button
          type="button"
          className={entryMode === "scan" ? "active" : ""}
          aria-pressed={entryMode === "scan"}
          onClick={() => changeEntryMode("scan")}
        >
          Scan ticket
        </button>
        <button
          type="button"
          className={entryMode === "duration" ? "active" : ""}
          aria-pressed={entryMode === "duration"}
          onClick={() => changeEntryMode("duration")}
        >
          Enter duration
        </button>
      </div>

      {entryMode === "scan" && (
        <>
          {!cameraOpen && !previewUrl && (
            <section className="parking-source-panel" aria-label="Choose parking receipt source">
              <div className="parking-source-actions">
                <button type="button" onClick={startCamera}>
                  <FaCamera /><span><strong>Camera</strong><small>Take a photo</small></span>
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  <FaUpload /><span><strong>Gallery</strong><small>Choose a photo</small></span>
                </button>
              </div>
            </section>
          )}

          {cameraOpen && (
            <section className="parking-live-camera">
              <video ref={videoRef} playsInline muted aria-label="Live parking receipt camera" />
              <div className="parking-camera-hint">Keep the whole ticket visible</div>
              <div className="parking-live-actions">
                <button type="button" className="close-btn" onClick={stopCamera}>Cancel</button>
                <button type="button" className="parking-primary-button" onClick={captureReceipt}><FaCamera /> Take photo</button>
              </div>
            </section>
          )}

          {previewUrl && (
            <section className={`parking-ticket-preview ${scanState === "error" ? "has-error" : scanState === "success" ? "has-success" : ""}`}>
              <img src={previewUrl} alt="Selected Abrihot parking ticket" />
              <div className="parking-ticket-status">
                <strong>{scanState === "reading" ? "Reading ticket" : "Ticket added"}</strong>
                <small>{scanMessage}</small>
                {scanState === "reading" && (
                  <div className="parking-progress"><i style={{ width: `${scanProgress}%` }}></i></div>
                )}
              </div>
              {scanState !== "reading" && (
                <button type="button" className="parking-icon-button" onClick={resetScan} aria-label="Choose another ticket"><FaRedo /></button>
              )}
            </section>
          )}

          <input
            ref={fileInputRef}
            className="parking-file-input"
            type="file"
            accept="image/*"
            onChange={(event) => {
              scanReceipt(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <canvas ref={captureCanvasRef} hidden></canvas>

          {scanState === "error" && !previewUrl && <p className="parking-inline-error">{scanMessage}</p>}

          {parkingDraft.date && (
            <section className="parking-review-panel">
              <div className="parking-review-heading">
                <strong>Entry time</strong>
                <small>Check it against the ticket.</small>
              </div>
              <label className="parking-entry-field">
                <span><FaClock /> Date and time</span>
                <input
                  type="text"
                  value={parkingDraft.date}
                  onChange={(event) => setParkingDraft((current) => ({ ...current, date: event.target.value }))}
                  placeholder="DD/MM/YYYY HH:MM:SS"
                  disabled={saving}
                />
              </label>

              {!charge.error && (
                <div className="parking-payment-row">
                  <div><small>{formatParkingDuration(charge.elapsedMinutes)}</small><span>Parking total</span></div>
                  <strong>{amountText} <small>ETB</small></strong>
                </div>
              )}
              {charge.error && <p className="parking-inline-error">{charge.error}</p>}

              <button type="button" className="parking-save-btn" onClick={onSave} disabled={!canSave}>
                {saving ? "Saving..." : `Save ${charge.error ? "payment" : `${amountText} ETB`}`}
              </button>
            </section>
          )}
        </>
      )}

      {entryMode === "duration" && (
        <section className="parking-review-panel parking-duration-panel">
          <div className="parking-review-heading">
            <strong>Parking duration</strong>
            <small>Enter how long the vehicle was parked.</small>
          </div>
          <div className="parking-duration-inputs">
            <label className="parking-entry-field">
              <span>Hours</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={durationHours}
                onChange={(event) => setDurationHours(event.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="0"
                disabled={saving}
              />
            </label>
            <label className="parking-entry-field">
              <span>Minutes</span>
              <input
                type="number"
                min="0"
                max="59"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(event) => {
                  const value = event.target.value.replace(/\D/g, "");
                  setDurationMinutes(value === "" ? "" : String(Math.min(59, Number(value))));
                }}
                placeholder="0"
                disabled={saving}
              />
            </label>
          </div>

          {enteredDurationMinutes > 0 && (
            <div className="parking-payment-row">
              <div><small>{formatParkingDuration(enteredDurationMinutes)}</small><span>Parking total</span></div>
              <strong>{amountText} <small>ETB</small></strong>
            </div>
          )}

          <button type="button" className="parking-save-btn" onClick={onSave} disabled={!canSave}>
            {saving ? "Saving..." : enteredDurationMinutes > 0 ? `Save ${amountText} ETB` : "Enter parking duration"}
          </button>
        </section>
      )}
    </div>
  );
}
