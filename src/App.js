import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FaLink, FaQrcode, FaImage, FaCar } from "react-icons/fa";
import Content from "./Content";
import Balance from "./Balance";
import Calculator from "./Calculator";
import Users from "./Users";
import DesktopLayout from "./desktop/DesktopLayout";
import "./App.css";

const SUPABASE_URL = "https://ywplzexakisliebyjtyf.supabase.co";
const SUPABASE_KEY = "sb_publishable_nmA6IJsDGUVki5i0smS1Tg_MLXy5_wX";

const BASE_BALANCE = 1209518;
const VERSION = "1.3.3.25"; // html.css.sys.db
const PASSWORD = "dawit123";
const API_URL =
  process.env.REACT_APP_API_URL || "https://bank-backend-anhp.onrender.com";
const BANK_RECEIPT_URL = "https://cs.bankofabyssinia.com/slip/";
const GENERATED_TRANSACTION_FIELDS = ["id", "created_at"];

const getCurrentDateTimeString = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};
function App() {

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [view, setView] = useState("transactions");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 900);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path.startsWith("/balance")) {
        setView("balance");
      } else {
        setView("transactions");
      }
    };
    handleLocationChange();
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
    if (path.startsWith("/balance")) {
      setView("balance");
    } else {
      setView("transactions");
    }
  };
  const DEFAULT_PEOPLE = useMemo(() => [
    { id: "dawit", name: "Dawit", role: "Administrator", class: "avatar-dawit" },
    { id: "mihret", name: "Mihret", role: "Construction Manager", class: "avatar-mihret" },
    { id: "asnake", name: "Asnake", role: "Project Coordinator", class: "avatar-asnake" },
    { id: "yiss", name: "Yiss", role: "Finance Officer", class: "avatar-yiss" },
    { id: "enku", name: "Enku", role: "Procurement Specialist", class: "avatar-enku" }
  ], []);

  const [transactions, setTransactions] = useState([]);
  const [boaSmsState, setBoaSmsState] = useState(null);
  const [boaSmsSummary, setBoaSmsSummary] = useState([]);
  const [boaSmsLoading, setBoaSmsLoading] = useState(false);
  const [parkingPayments, setParkingPayments] = useState([]);
  const [suqePayments, setSuqePayments] = useState([]);
  const [people, setPeople] = useState(DEFAULT_PEOPLE);

  const [parkingDraft, setParkingDraft] = useState({
    amount: "",
    date: getCurrentDateTimeString(),
    reference: "",
    narrative: ""
  });

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/people?select=*`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setPeople(data);
        } else {
          setPeople(DEFAULT_PEOPLE);
        }
      } else {
        setPeople(DEFAULT_PEOPLE);
      }
    } catch (err) {
      console.error("Error fetching people in App:", err);
      setPeople(DEFAULT_PEOPLE);
    }
  }, [DEFAULT_PEOPLE]);

  const personOptions = useMemo(() => {
    return [
      { label: "Dawit", value: "dawit" },
      { label: "Mihret", value: "mihret" },
      { label: "Asnake", value: "asnake" },
      { label: "Yiss", value: "yiss" },
      { label: "Enku", value: "enku" },
      ...people
        .filter(p => !["dawit", "mihret", "asnake", "yiss", "enku"].includes(p.id))
        .map(p => ({ label: p.name, value: p.id })),
      { label: "Null", value: "null" }
    ];
  }, [people]);

  const handleParkingDraftSubmit = async () => {
    if (!parkingDraft.amount || !parkingDraft.date) {
      alert("Please fill in amount and date fields!");
      return;
    }
    setDraftSaving(true);
    try {
      const payload = {
        amount: parseFloat(parkingDraft.amount) || 0,
        date: parkingDraft.date,
        reference: parkingDraft.reference || "",
        narrative: parkingDraft.narrative || "",
        person: "dawit"
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/parking`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        await fetchDbPayments();
        setShowModal(false);
        setReceiptMode(null);
        setParkingDraft({
          amount: "",
          date: getCurrentDateTimeString(),
          reference: "",
          narrative: ""
        });
      } else {
        alert("Failed to save parking payment to Supabase.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving parking payment.");
    } finally {
      setDraftSaving(false);
    }
  };

  const fetchDbPayments = useCallback(async () => {
    try {
      const headers = {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      };
      const [parkingRes, suqeRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/parking?select=*`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/suqe?select=*`, { headers })
      ]);
      if (parkingRes.ok && suqeRes.ok) {
        const parkingData = await parkingRes.json();
        const suqeData = await suqeRes.json();
        setParkingPayments(parkingData);
        setSuqePayments(suqeData);
      }
    } catch (err) {
      console.error("DB FETCH ERROR IN APP:", err);
    }
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [receiptMode, setReceiptMode] = useState(null);
  const [url, setUrl] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [receiptDraft, setReceiptDraft] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorImportValue, setCalculatorImportValue] = useState(null);
  const [calculatorImportToken, setCalculatorImportToken] = useState(0);

  // ONLY KEEP THIS FOR BALANCE TAB
  const [constructionOnly, setConstructionOnly] = useState(false);

  // DROPDOWN FILTER
  const [personFilter, setPersonFilter] = useState("ALL");

  // AUTH
  const [authenticated, setAuthenticated] = useState(false);
  const [inputPassword, setInputPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const videoRef = useRef(null);
  const qrStreamRef = useRef(null);
  const qrFrameRef = useRef(null);
  const qrDetectedRef = useRef(false);
  const [qrStatus, setQrStatus] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [zoomRange, setZoomRange] = useState(null);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [imageStatus, setImageStatus] = useState("");
  const [imageProgress, setImageProgress] = useState(0);

  useEffect(() => {

    const auth = localStorage.getItem("authenticated");

    if (auth === "true") {
      setAuthenticated(true);
    }

    fetchTransactions();
    fetchBoaSmsState();
    fetchBoaSmsSummary();
    fetchDbPayments();
    fetchPeople();

  // Initial app hydration should run once when the app mounts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDbPayments, fetchPeople]);

  const fetchTransactions = async () => {

    try {

      const res = await fetch(`${API_URL}/transactions`);

      const data = await res.json();

      setTransactions(data);

    } catch (err) {

      console.error("FETCH ERROR:", err);

    } finally {

      setLoadingMessage(false);

    }
  };

  const readApiResponse = async (res) => {
    try {
      return await res.json();
    } catch (err) {
      return {
        error: `Request failed with status ${res.status}`
      };
    }
  };

  const getDraftTemplate = () => {
    return transactions[0]
      ? Object.fromEntries(
          Object.keys(transactions[0])
            .filter((key) => !GENERATED_TRANSACTION_FIELDS.includes(key))
            .map((key) => [key, ""])
        )
      : {};
  };

  const showReceiptDraft = (data) => {
    setReceiptDraft({
      ...getDraftTemplate(),
      ...data
    });
  };

  const updateTransactionDirectly = async (id, transaction) => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/transactions?id=eq.${id}&select=*`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(transaction)
      }
    );

    const data = await readApiResponse(res);

    if (!res.ok) {
      throw new Error(data.details || data.message || data.error || "Update failed");
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Supabase update policy is missing or this row is not visible for update.");
    }
  };

  const deleteTransactionDirectly = async (id) => {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/transactions?id=eq.${id}&select=id`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "return=representation"
        }
      }
    );

    const data = await readApiResponse(res);

    if (!res.ok) {
      throw new Error(data.details || data.message || data.error || "Delete failed");
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Supabase delete policy is missing or this row is not visible for delete.");
    }
  };

  const handleScrape = async (nextUrl = url) => {

    const receiptUrl =
      typeof nextUrl === "string" ? nextUrl.trim() : url.trim();

    if (!receiptUrl) {
      alert("Paste or scan receipt link!");
      return;
    }

    setUrl(receiptUrl);
    setScrapeLoading(true);

    try {

      const res = await fetch(
        `${API_URL}/scrape-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ url: receiptUrl }),
        }
      );

      const data = await readApiResponse(res);

      if (!res.ok) {
        alert(data.error || "Scraping failed");
        return;
      }

      showReceiptDraft(data);

    } catch (err) {

      console.error("SCRAPE ERROR:", err);
      alert("Scraping failed.");

    } finally {

      setScrapeLoading(false);

    }
  };

  const fetchBoaSmsState = async () => {
    setBoaSmsLoading(true);

    try {
      const res = await fetch(`${API_URL}/boa-sms/account-state`);
      const data = await readApiResponse(res);

      if (!res.ok) {
        console.error("BOA SMS STATE ERROR:", data);
        return;
      }

      setBoaSmsState(data);

    } catch (err) {
      console.error("BOA SMS FETCH ERROR:", err);
    } finally {
      setBoaSmsLoading(false);
    }
  };

  const fetchBoaSmsSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/boa-sms/monthly-summary`);
      const data = await readApiResponse(res);

      if (!res.ok) {
        console.error("BOA SMS SUMMARY ERROR:", data);
        return;
      }

      setBoaSmsSummary(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      console.error("BOA SMS SUMMARY FETCH ERROR:", err);
    }
  };

  useEffect(() => {
    if (view !== "balance") {
      return undefined;
    }

    fetchBoaSmsState();
    fetchBoaSmsSummary();
    const timer = setInterval(() => {
      fetchBoaSmsState();
      fetchBoaSmsSummary();
    }, 15000);

    return () => clearInterval(timer);
  // Keep the SMS snapshot fresh while the Balance/Apollo card is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const sendTableTotalToCalculator = (tableTotal) => {
    setCalculatorImportValue(String(tableTotal));
    setCalculatorImportToken((current) => current + 1);
    setShowCalculator(true);
  };

  const stopQrScanner = () => {
    if (qrFrameRef.current) {
      cancelAnimationFrame(qrFrameRef.current);
      qrFrameRef.current = null;
    }

    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach((track) => track.stop());
      qrStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setZoomRange(null);
  };

  const isRearCamera = (device) => {
    const label = device.label.toLowerCase();

    return (
      label.includes("back") ||
      label.includes("rear") ||
      label.includes("environment")
    );
  };

  const isFrontCamera = (device) => {
    const label = device.label.toLowerCase();

    return (
      label.includes("front") ||
      label.includes("user") ||
      label.includes("selfie") ||
      label.includes("facetime")
    );
  };

  const getRearCameraDevices = (devices, activeDeviceId) => {
    const videoDevices = devices.filter((device) => device.kind === "videoinput");
    const rearCameras = videoDevices.filter(isRearCamera);

    if (rearCameras.length) {
      return rearCameras;
    }

    const activeCamera = videoDevices.find(
      (device) => device.deviceId === activeDeviceId && !isFrontCamera(device)
    );

    return activeCamera ? [activeCamera] : [];
  };

  const getPreferredCameraId = (devices) => {
    const rearCameras = getRearCameraDevices(devices);

    const normalRearCamera = rearCameras.find((device) => {
      const label = device.label.toLowerCase();
      return (
        !label.includes("ultra") &&
        !label.includes("wide") &&
        !label.includes("macro") &&
        !label.includes("depth") &&
        !label.includes("0.5")
      );
    });

    return normalRearCamera?.deviceId || rearCameras[0]?.deviceId || "";
  };

  const getReceiptUrlFromQrValue = (rawValue) => {
    const value = rawValue.trim();

    if (!value) return "";

    try {
      return new URL(value).toString();
    } catch (err) {
      const reference = value.match(/FT[0-9A-Z]{8,}/i)?.[0];

      if (reference) {
        return `${BANK_RECEIPT_URL}?trx=${reference.toUpperCase()}`;
      }

      return "";
    }
  };

  const parseReceiptText = (text) => {
    const normalized = text
      .replace(/\r/g, "\n")
      .replace(/[|]/g, " ")
      .replace(/[ \t]+/g, " ");
    const lines = normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const fullText = lines.join(" ");

    const reference =
      fullText.match(/FT[0-9A-Z]{8,}/i)?.[0]?.toUpperCase() || "";
    const imageReceiptReference =
      reference && !reference.endsWith("41349")
        ? `${reference}41349`
        : reference;
    const date =
      fullText.match(/\b\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})[,\s]+\d{1,2}:\d{2}\b/)?.[0] ||
      "";
    const amountLine =
      lines.find((line) =>
        /amount|transferred|transfer|etb|birr/i.test(line) &&
        /[\d,]+(?:\.\d{1,2})?/.test(line)
      ) || fullText;
    const amount =
      amountLine.match(/(?:ETB|Birr)?\s*[\d,]+(?:\.\d{1,2})?/i)?.[0]
        ?.replace(/^(ETB|Birr)\s*/i, "")
        .trim() || "";

    const narrativeIndex = lines.findIndex((line) =>
      /narrative|reason|description|payment/i.test(line)
    );
    const narrative =
      narrativeIndex >= 0
        ? (lines[narrativeIndex + 1] || lines[narrativeIndex])
            .replace(/^(narrative|reason|description|payment reason)\s*:?\s*/i, "")
            .trim()
        : "";

    return {
      amount,
      date,
      reference,
      narrative,
      receipt_url: imageReceiptReference
        ? `${BANK_RECEIPT_URL}?trx=${imageReceiptReference}`
        : "",
      is_withdraw: true,
      person: null
    };
  };

  const handleImageReceipt = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setImageStatus("Reading image...");
    setImageProgress(0);
    setScrapeLoading(true);

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(file, "eng", {
        logger: (message) => {
          if (message.status) {
            setImageStatus(message.status);
          }

          if (typeof message.progress === "number") {
            setImageProgress(Math.round(message.progress * 100));
          }
        }
      });
      const parsed = parseReceiptText(result.data.text || "");

      if (!parsed.amount && !parsed.reference && !parsed.date) {
        alert("Could not read receipt details from this image. Try a clearer screenshot.");
        return;
      }

      showReceiptDraft(parsed);

    } catch (err) {
      console.error("IMAGE OCR ERROR:", err);
      alert("Image reading failed.");

    } finally {
      setScrapeLoading(false);
      setImageProgress(0);
      event.target.value = "";
    }
  };

  const applyCameraZoom = async (value) => {
    const track = qrStreamRef.current?.getVideoTracks()[0];

    if (!track || !zoomRange) return;

    const nextZoom = Number(value);

    try {
      await track.applyConstraints({
        advanced: [{ zoom: nextZoom }]
      });
      setCameraZoom(nextZoom);
    } catch (err) {
      console.error("ZOOM ERROR:", err);
      setQrStatus("This camera does not allow zoom changes.");
    }
  };

  const startQrScanner = async (deviceId = selectedCameraId, allowCameraSwitch = true) => {
    stopQrScanner();
    qrDetectedRef.current = false;

    if (!("BarcodeDetector" in window)) {
      setQrStatus("QR scanning is not supported in this browser.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setQrStatus("Camera access is not available in this browser.");
      return;
    }

    try {
      setQrStatus("Opening camera...");

      const detector = new window.BarcodeDetector({
        formats: ["qr_code"]
      });

      const videoConstraints = deviceId
        ? {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        : {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          };

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      qrStreamRef.current = stream;

      const devices = await navigator.mediaDevices.enumerateDevices();
      const activeTrack = stream.getVideoTracks()[0];
      const activeSettings = activeTrack.getSettings();
      const rearDevices = getRearCameraDevices(devices, activeSettings.deviceId);
      const preferredCameraId = getPreferredCameraId(rearDevices);
      const activeLabel = activeTrack.label.toLowerCase();
      const activeLooksWide =
        activeLabel.includes("ultra") ||
        activeLabel.includes("wide") ||
        activeLabel.includes("macro") ||
        activeLabel.includes("0.5");

      if (
        allowCameraSwitch &&
        preferredCameraId &&
        preferredCameraId !== activeSettings.deviceId &&
        (activeLooksWide || !deviceId)
      ) {
        stopQrScanner();
        setSelectedCameraId(preferredCameraId);
        await startQrScanner(preferredCameraId, false);
        return;
      }

      setCameraDevices(rearDevices);
      setSelectedCameraId(activeSettings.deviceId || preferredCameraId);

      const capabilities = activeTrack.getCapabilities?.();

      if (capabilities?.zoom) {
        const targetZoom = Math.min(
          capabilities.zoom.max,
          Math.max(capabilities.zoom.min, 2)
        );

        setZoomRange({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step || 0.1
        });
        setCameraZoom(targetZoom);

        try {
          await activeTrack.applyConstraints({
            advanced: [{ zoom: targetZoom }]
          });
        } catch (err) {
          console.error("INITIAL ZOOM ERROR:", err);
        }
      }

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setQrStatus("Point the camera at the receipt QR code.");

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", {
        willReadFrequently: true
      });

      const scan = async () => {
        if (!videoRef.current || qrDetectedRef.current) return;

        try {
          const video = videoRef.current;

          if (!video.videoWidth || !video.videoHeight || !context) {
            qrFrameRef.current = requestAnimationFrame(scan);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const codes = await detector.detect(canvas);
          const rawValue = codes[0]?.rawValue;

          if (rawValue) {
            qrDetectedRef.current = true;
            stopQrScanner();

            try {
              const detectedUrl = getReceiptUrlFromQrValue(rawValue);

              if (!detectedUrl) {
                setQrStatus("This QR contains a bank token, not a direct receipt link. Use Image OCR or paste the receipt link.");
                return;
              }

              setQrStatus("QR found. Scraping receipt...");
              setReceiptMode("link");
              await handleScrape(detectedUrl);
            } catch (err) {
              setQrStatus("QR code was found, but it could not be converted to a receipt link.");
            }

            return;
          }
        } catch (err) {
          console.error("QR SCAN ERROR:", err);
        }

        qrFrameRef.current = requestAnimationFrame(scan);
      };

      qrFrameRef.current = requestAnimationFrame(scan);

    } catch (err) {
      console.error("CAMERA ERROR:", err);
      setQrStatus("Camera permission was blocked or unavailable.");
      stopQrScanner();
    }
  };

  const handleDraftChange = (field, value) => {
    setReceiptDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const normalizeDraftValue = (value) => {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    return value;
  };

  const handleSaveDraft = async () => {
    if (!receiptDraft) return;

    const transaction = Object.fromEntries(
      Object.entries(receiptDraft)
        .filter(([key]) => !GENERATED_TRANSACTION_FIELDS.includes(key))
        .map(([key, value]) => [key, normalizeDraftValue(value)])
    );

    setDraftSaving(true);

    try {
      if (receiptDraft.id) {
        const res = await fetch(`${API_URL}/transactions/${receiptDraft.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(transaction)
        });

        const data = await readApiResponse(res);

        if (!res.ok) {
          if (res.status === 404) {
            await updateTransactionDirectly(receiptDraft.id, transaction);
            await fetchTransactions();
            setReceiptDraft(null);
            setShowModal(false);
            setUrl("");
            return;
          }

          alert(data.details || data.error || "Update failed");
          return;
        }

        await fetchTransactions();
        setReceiptDraft(null);
        setShowModal(false);
        setUrl("");
        return;
      }

      const res = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(transaction)
      });

      const data = await readApiResponse(res);

      if (!res.ok) {
        if (res.status === 404) {
          alert("Save endpoint is missing on the backend, and this draft was not auto-saved with an id.");
          return;
        }

        alert(data.details || data.error || "Save failed");
        return;
      }

      await fetchTransactions();
      setReceiptDraft(null);
      setShowModal(false);
      setUrl("");

    } catch (err) {
      console.error("SAVE ERROR:", err);
      alert(err.message || "Save failed.");

    } finally {
      setDraftSaving(false);
    }
  };

  const handleCloseModal = () => {
    if (scrapeLoading || draftSaving) return;

    stopQrScanner();
    setShowModal(false);
    setReceiptMode(null);
    setReceiptDraft(null);
    setUrl("");
    setQrStatus("");
    setImageStatus("");
    setImageProgress(0);
  };

  const openReceiptModal = () => {
    setReceiptMode(null);
    setReceiptDraft(null);
    setUrl("");
    setQrStatus("");
    setImageStatus("");
    setImageProgress(0);
    setShowModal(true);
  };

  const handleEditTransaction = (tx) => {
    stopQrScanner();
    setReceiptMode("link");
    setUrl(tx.receipt_url || "");
    setReceiptDraft({ ...tx });
    setShowModal(true);
  };

  useEffect(() => {
    if (showModal && receiptMode === "qr" && !receiptDraft) {
      startQrScanner();
    } else {
      stopQrScanner();
    }

    return () => {
      stopQrScanner();
    };
    // startQrScanner reads live refs/state and should only run when the modal mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, receiptMode, receiptDraft]);

  const handleDeleteTransaction = (tx) => {
    setDeleteTarget(tx);
  };

  const confirmDeleteTransaction = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);

    try {
      const res = await fetch(`${API_URL}/transactions/${deleteTarget.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await readApiResponse(res);
        if (res.status === 404) {
          await deleteTransactionDirectly(deleteTarget.id);
          await fetchTransactions();
          setDeleteTarget(null);
          return;
        }

        alert(data.details || data.error || "Delete failed");
        return;
      }

      await fetchTransactions();
      setDeleteTarget(null);

    } catch (err) {
      console.error("DELETE ERROR:", err);
      alert(err.message || "Delete failed.");

    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePasswordSubmit = () => {

    if (inputPassword === PASSWORD) {

      localStorage.setItem("authenticated", "true");

      setAuthenticated(true);
      setPasswordError(false);

    } else {

      setPasswordError(true);

    }
  };

  /*
  =========================
  TRANSACTION FILTERING
  =========================
  */

  const filteredTransactions = transactions.filter((tx) => {

    if (personFilter === "ALL") {
      return true;
    }

    if (personFilter === "Withdraw") {
      return tx.is_withdraw !== false;
    }

    if (personFilter === "Deposit") {
      return tx.is_withdraw === false;
    }

    if (personFilter === "CONSTRUCTION") {
      return (
        tx.person === "mihret" ||
        tx.person === "asnake" ||
        tx.person === null
      );
    }

    return (tx.person || "").toLowerCase() === personFilter.toLowerCase();

  });

  /*
  =========================
  BALANCE CALCULATION
  =========================
  */

  let totalWithdraw = 0;

  transactions.forEach((tx) => {

    // BALANCE TAB CONSTRUCTION FILTER
    if (
      constructionOnly &&
      tx.person !== "mihret" &&
      tx.person !== "asnake" &&
      tx.person !== null
    ) {
      return;
    }

    const amount = parseFloat(
      tx.amount?.toString().replace(/,/g, "")
    ) || 0;

    // deposits
    if (tx.is_withdraw === false) {
      totalWithdraw -= amount;
    }

    // withdraws
    else {
      totalWithdraw += amount;
    }

  });

  // Deduct custom payments from overall balance!
  if (!constructionOnly) {
    parkingPayments.forEach((p) => {
      totalWithdraw += parseFloat(p.amount) || 0;
    });
    suqePayments.forEach((s) => {
      totalWithdraw += parseFloat(s.amount) || 0;
    });
  }

  const currentBalance = BASE_BALANCE - totalWithdraw;

  const lastWithdraw = transactions.find(
    tx => tx.is_withdraw !== false
  );

  /*
  =========================
  PASSWORD SCREEN
  =========================
  */

  if (!authenticated) {
    return (
      <div className="password-overlay">
        <div className="password-box">
          <div className="login-header">
            <img 
              src="/logo.png" 
              alt="Bank Logo" 
              className="login-logo" 
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <h2>Welcome Back</h2>
          </div>

          <div className="login-field">
            <label>Username</label>
            <input 
              type="text" 
              value="Dawit Enku" 
              disabled 
              placeholder="Username" 
            />
          </div>

          <div className="login-field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
              autoFocus
            />
          </div>

          {passwordError && (
            <div className="login-error-msg">
              Incorrect password
            </div>
          )}

          <button className="login-submit-btn" onClick={handlePasswordSubmit}>
            Submit
          </button>
        </div>
      </div>
    );
  }

  const isUserDetailPage = currentPath.startsWith("/balance/people/") && currentPath.split("/").filter(Boolean).length > 2;
  const isConstructionDetailPage = currentPath.startsWith("/balance/construction/") && currentPath.split("/").filter(Boolean).length > 2;
  const isBalanceDetailPage = isUserDetailPage || isConstructionDetailPage;

  const renderBalance = () => (
    <Balance
      balance={currentBalance}
      boaSmsState={boaSmsState}
      boaSmsSummary={boaSmsSummary}
      boaSmsLoading={boaSmsLoading}
      onRefreshBoaSmsState={fetchBoaSmsState}
      lastWithdraw={lastWithdraw}
      totalWithdraw={totalWithdraw}
      transactions={[
        ...transactions,
        ...parkingPayments.map(p => ({ ...p, is_withdraw: true, person: "dawit" })),
        ...suqePayments.map(s => ({ ...s, is_withdraw: true, person: "yiss" }))
      ]}
      constructionOnly={constructionOnly}
      setConstructionOnly={setConstructionOnly}
      currentPath={currentPath}
      navigate={navigate}
      parkingPayments={parkingPayments}
      suqePayments={suqePayments}
      fetchDbPayments={fetchDbPayments}
      people={people}
      fetchPeople={fetchPeople}
    />
  );

  if (authenticated && isDesktop) {
    return (
      <DesktopLayout
        transactions={transactions}
        boaSmsState={boaSmsState}
        boaSmsSummary={boaSmsSummary}
        boaSmsLoading={boaSmsLoading}
        parkingPayments={parkingPayments}
        suqePayments={suqePayments}
        people={people}
        fetchTransactions={fetchTransactions}
        fetchBoaSmsState={fetchBoaSmsState}
        fetchBoaSmsSummary={fetchBoaSmsSummary}
        fetchDbPayments={fetchDbPayments}
        fetchPeople={fetchPeople}
        currentBalance={currentBalance}
        totalWithdraw={totalWithdraw}
        lastWithdraw={lastWithdraw}
        personFilter={personFilter}
        setPersonFilter={setPersonFilter}
        filteredTransactions={filteredTransactions}
        handleEditTransaction={handleEditTransaction}
        handleDeleteTransaction={handleDeleteTransaction}
        navigate={navigate}
        currentPath={currentPath}
        showModal={showModal}
        setShowModal={setShowModal}
        receiptMode={receiptMode}
        setReceiptMode={setReceiptMode}
        url={url}
        setUrl={setUrl}
        scrapeLoading={scrapeLoading}
        receiptDraft={receiptDraft}
        setReceiptDraft={setReceiptDraft}
        draftSaving={draftSaving}
        handleSaveDraft={handleSaveDraft}
        handleCloseModal={handleCloseModal}
        deleteTarget={deleteTarget}
        setDeleteTarget={setDeleteTarget}
        deleteLoading={deleteLoading}
        confirmDeleteTransaction={confirmDeleteTransaction}
        showCalculator={showCalculator}
        setShowCalculator={setShowCalculator}
        calculatorImportValue={calculatorImportValue}
        calculatorImportToken={calculatorImportToken}
        sendTableTotalToCalculator={sendTableTotalToCalculator}
        loadingMessage={loadingMessage}
        setLoadingMessage={setLoadingMessage}
        videoRef={videoRef}
        qrStatus={qrStatus}
        setQrStatus={setQrStatus}
        cameraDevices={cameraDevices}
        selectedCameraId={selectedCameraId}
        setSelectedCameraId={setSelectedCameraId}
        zoomRange={zoomRange}
        cameraZoom={cameraZoom}
        applyCameraZoom={applyCameraZoom}
        startQrScanner={startQrScanner}
        stopQrScanner={stopQrScanner}
        handleImageReceipt={handleImageReceipt}
        imageStatus={imageStatus}
        imageProgress={imageProgress}
        parkingDraft={parkingDraft}
        setParkingDraft={setParkingDraft}
        handleParkingDraftSubmit={handleParkingDraftSubmit}
        personOptions={personOptions}
        handleDraftChange={handleDraftChange}
        openReceiptModal={openReceiptModal}
      />
    );
  }

  return (
    <div className="app">

      {loadingMessage && (
        <div className="loading-overlay" role="status" aria-live="polite">
          <div className="loading-box">
            <button
              className="loading-close"
              onClick={() => setLoadingMessage(false)}
              type="button"
              aria-label="Dismiss data update notification"
            >
              ✕
            </button>

            <div className="loading-brand-mark">
              <img src="/logo.png" alt="Bank of Abyssinia" />
            </div>

            <div className="loading-copy">
              <span>Account update</span>
              <h2>Getting your latest bank data</h2>
              <p>
                This may take a few seconds. This message will close automatically when your transactions arrive.
              </p>
              <p className="loading-copy-amharic">
                ከባንኩ መረጃ ለመውሰድ ጥቂት ሰከንዶች ሊወስድ ይችላል።
              </p>
            </div>

            <div className="loading-progress" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      )}

      {scrapeLoading && (
        <div className="scrape-loading-overlay">
          <div className="spinner"></div>
          <p>Scraping receipt...</p>
        </div>
      )}

      {isBalanceDetailPage ? (
        <div className="content" style={{ padding: "30px 20px" }}>
          {isUserDetailPage ? (
            <Users
              transactions={transactions}
              currentPath={currentPath}
              navigate={navigate}
              parkingPayments={parkingPayments}
              suqePayments={suqePayments}
              fetchDbPayments={fetchDbPayments}
              people={people}
              fetchPeople={fetchPeople}
            />
          ) : renderBalance()}
        </div>
      ) : (
        <>
          <img
            src="/logo.png"
            className="logo"
            alt="bank logo"
          />

          <div className="toggle">

            <button
              className={view === "transactions" ? "active" : ""}
              onClick={() => navigate("/transactions")}
            >
              Transactions
            </button>

            <button
              className={view === "balance" ? "active" : ""}
              onClick={() => navigate("/balance")}
            >
              Balance
            </button>

          </div>

          <div className="content">

            {view === "transactions" && (
              <>

                <Content
                  transactions={filteredTransactions}
                  personFilter={personFilter}
                  setPersonFilter={setPersonFilter}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onSendTableTotal={sendTableTotalToCalculator}
                  navigate={navigate}
                  people={people}
                />

                <button
                  className="add-btn"
                  onClick={openReceiptModal}
                >
                  +
                </button>

                <button
                  className="calculator-btn"
                  onClick={() => setShowCalculator(!showCalculator)}
                >
                  🧮 Calculator
                </button>

              </>
            )}

            {view === "balance" && (
              <>

                {renderBalance()}

                <button
                  className="calculator-btn"
                  onClick={() => setShowCalculator(!showCalculator)}
                >
                  🧮 Calculator
                </button>

              </>
            )}

            {showCalculator && (
              <Calculator
                importValue={calculatorImportValue}
                importToken={calculatorImportToken}
              />
            )}

          </div>
        </>
      )}

      <footer className="footer">
        Version {VERSION}
      </footer>

      {showModal && (
        <div className="modal-overlay">

          <div className="modal">

            <h2>{receiptDraft?.id ? "Edit Transaction" : "Add Receipt"}</h2>

              {!receiptDraft && receiptMode === "parking" && (
                  <button
                    className="save-draft-btn"
                    onClick={handleParkingDraftSubmit}
                    disabled={draftSaving}
                  >
                    {draftSaving ? "Saving..." : "Save Parking"}
                  </button>
                )}

                {!receiptDraft && receiptMode && (
                  <button
                    className="close-btn"
                    onClick={() => {
                      stopQrScanner();
                      setReceiptMode(null);
                      setQrStatus("");
                    }}
                    disabled={scrapeLoading || draftSaving}
                  >
                    Back
                  </button>
                )}

              {!receiptDraft && !receiptMode && (
                <div className="receipt-choice-grid">
                  <button
                    className="receipt-choice-card"
                    onClick={() => setReceiptMode("link")}
                  >
                    <div className="receipt-choice-details">
                      <span>Link</span>
                      <small>Paste a receipt link</small>
                    </div>
                    <FaLink className="receipt-choice-icon" />
                  </button>

                  <button
                    className="receipt-choice-card"
                    onClick={() => setReceiptMode("qr")}
                  >
                    <div className="receipt-choice-details">
                      <span>QR</span>
                      <small>Scan from camera</small>
                    </div>
                    <FaQrcode className="receipt-choice-icon" />
                  </button>

                  <button
                    className="receipt-choice-card"
                    onClick={() => setReceiptMode("image")}
                  >
                    <div className="receipt-choice-details">
                      <span>Image</span>
                      <small>Read a screenshot</small>
                    </div>
                    <FaImage className="receipt-choice-icon" />
                  </button>

                  <button
                    className="receipt-choice-card"
                    onClick={() => setReceiptMode("parking")}
                  >
                    <div className="receipt-choice-details">
                      <span>Parking</span>
                      <small>Add parking payment (<span className="parking-dave-label">Dave</span>)</small>
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
                  onChange={(e) => setUrl(e.target.value)}
                />
              )}

              {!receiptDraft && receiptMode === "qr" && (
                <div className="qr-scanner-panel">
                  {cameraDevices.length > 1 && (
                    <label className="qr-control-field">
                      <span>Camera</span>
                      <select
                        value={selectedCameraId}
                        onChange={(e) => {
                          setSelectedCameraId(e.target.value);
                          startQrScanner(e.target.value, false);
                        }}
                      >
                        {cameraDevices.map((device, index) => (
                          <option
                            key={device.deviceId || index}
                            value={device.deviceId}
                          >
                            {device.label || `Camera ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <video
                    ref={videoRef}
                    className="qr-video"
                    playsInline
                    muted
                  ></video>

                  {zoomRange && (
                    <label className="qr-control-field">
                      <span>Zoom {cameraZoom.toFixed(1)}x</span>
                      <input
                        type="range"
                        min={zoomRange.min}
                        max={zoomRange.max}
                        step={zoomRange.step}
                        value={cameraZoom}
                        onChange={(e) => applyCameraZoom(e.target.value)}
                      />
                    </label>
                  )}

                  <p>{qrStatus || "Preparing camera..."}</p>
                </div>
              )}

              {!receiptDraft && receiptMode === "image" && (
                <div className="image-receipt-panel">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageReceipt}
                    disabled={scrapeLoading || draftSaving}
                  />

                  <p>
                    {imageStatus
                      ? `${imageStatus}${imageProgress ? ` ${imageProgress}%` : ""}`
                      : "Choose a clear receipt screenshot."}
                  </p>
                </div>
              )}

              {!receiptDraft && receiptMode === "parking" && (
                <div className="receipt-draft-box" style={{ marginTop: "15px" }}>
                  <h3 style={{ textTransform: "uppercase", fontSize: "12px", color: "#555", fontWeight: "800", marginBottom: "12px" }}>
                    Dave's Parking Payment
                  </h3>
                  <div className="receipt-draft-grid">
                    <label className="draft-field">
                      <span>Amount (ETB)</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={parkingDraft.amount}
                        onChange={(e) => setParkingDraft({ ...parkingDraft, amount: e.target.value })}
                        disabled={draftSaving}
                        required
                      />
                    </label>

                    <label className="draft-field">
                      <span>Date / Time</span>
                      <input
                        type="text"
                        value={parkingDraft.date}
                        onChange={(e) => setParkingDraft({ ...parkingDraft, date: e.target.value })}
                        disabled={draftSaving}
                        required
                      />
                    </label>

                    <label className="draft-field">
                      <span>Plate Number / Ref</span>
                      <input
                        type="text"
                        placeholder="e.g. Code 3 - AA 12345"
                        value={parkingDraft.reference}
                        onChange={(e) => setParkingDraft({ ...parkingDraft, reference: e.target.value })}
                        disabled={draftSaving}
                      />
                    </label>

                    <label className="draft-field">
                      <span>Narrative</span>
                      <input
                        type="text"
                        placeholder="Payment description..."
                        value={parkingDraft.narrative}
                        onChange={(e) => setParkingDraft({ ...parkingDraft, narrative: e.target.value })}
                        disabled={draftSaving}
                      />
                    </label>
                  </div>
                </div>
              )}

              {receiptDraft && (
                <div className="receipt-draft-box">
                  <h3>Review Receipt</h3>

                  <div className="receipt-draft-grid">
                    {Object.entries(receiptDraft)
                      .filter(([field]) =>
                        !GENERATED_TRANSACTION_FIELDS.includes(field)
                      )
                      .map(([field, value]) => (
                        <label key={field} className="draft-field">
                          <span>{field}</span>

                          {field === "person" ? (
                            <select
                              value={value ?? "null"}
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            >
                              {personOptions.map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : typeof value === "boolean" ? (
                            <select
                              value={String(value)}
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            >
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : value === null ? (
                            <input
                              type="text"
                              value="null"
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              value={value ?? ""}
                              onChange={(e) =>
                                handleDraftChange(field, e.target.value)
                              }
                            />
                          )}
                        </label>
                      ))}
                  </div>
                </div>
              )}

            <div className="modal-buttons">

              {!receiptDraft?.id && receiptMode === "link" && (
                <button
                  className="scrape-btn"
                  onClick={() => handleScrape()}
                  disabled={scrapeLoading || draftSaving}
                >
                  {receiptDraft ? "Scrape Again" : "Scrape"}
                </button>
              )}

              {!receiptDraft && receiptMode && (
                <button
                  className="close-btn"
                  onClick={() => {
                    stopQrScanner();
                    setReceiptMode(null);
                    setQrStatus("");
                  }}
                  disabled={scrapeLoading || draftSaving}
                >
                  Back
                </button>
              )}

              {receiptDraft && (
                <button
                  className="save-draft-btn"
                  onClick={handleSaveDraft}
                  disabled={draftSaving}
                >
                  {draftSaving
                    ? "Saving..."
                    : receiptDraft.id
                      ? "Save Changes"
                      : "Approve & Save"}
                </button>
              )}

              <button
                className="close-btn"
                onClick={handleCloseModal}
                disabled={scrapeLoading || draftSaving}
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

      {deleteTarget && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h2>Delete Transaction?</h2>

            <p>
              This will remove {deleteTarget.amount || "this transaction"} from the database.
            </p>

            <div className="confirm-actions">
              <button
                className="close-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Close
              </button>

              <button
                className="delete-confirm-btn"
                onClick={confirmDeleteTransaction}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
