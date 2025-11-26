/* src/pages/ImageUpload.js */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./ImageUpload.css";

/*
  Default preview is null initially.
*/
const DEFAULT_PREVIEW = null;

const ImageUpload = () => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(DEFAULT_PREVIEW);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("+91XXXXXXXXXX");
  const [language, setLanguage] = useState("en");
  const [voices, setVoices] = useState([]);
  const fileInputRef = useRef(null);

  // backend url (fallback to localhost if env not set)
  const BACKEND = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

  /* ---------- voices ---------- */
  useEffect(() => {
    const loadVoices = () => {
      const synthVoices = window.speechSynthesis.getVoices();
      if (synthVoices.length > 0) {
        setVoices(synthVoices);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  /* ---------- preview cleanup when file changes ---------- */
  useEffect(() => {
    return () => {
      // revoke object URL if component unmounts and we created one
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChooseClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    // revoke previous blob URL if any
    if (preview && preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }

    const url = URL.createObjectURL(file);
    setImage(file);
    setPreview(url);
    setResult("");
  };

  const getCurrentPosition = (options = {}) =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

  const isValidPhone = (p) => {
    if (!p) return false;
    // accept + and digits, 7-15 digits
    return /^\+?\d{7,15}$/.test(p.trim());
  };

  const speakText = (text, langCode) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();

    let selectedLang = langCode === "hi" ? "hi-IN" : langCode === "mr" ? "mr-IN" : "en-US";
    let selectedVoice = voices.find((v) => v.lang === selectedLang);
    if (!selectedVoice && langCode !== "en") {
      // fallback to hi-IN or en-US
      selectedLang = "hi-IN";
      selectedVoice = voices.find((v) => v.lang === selectedLang) || voices.find((v) => v.lang.startsWith("en"));
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = selectedLang;
    if (selectedVoice) utterance.voice = selectedVoice;
    synth.speak(utterance);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setResult("");
    if (!image) {
      alert("📷 Please upload an image first.");
      return;
    }
    if (!isValidPhone(phone)) {
      alert("📱 Enter a valid phone number (7-15 digits, optional leading +).");
      return;
    }

    setLoading(true);

    // Try to get GPS, but gracefully continue if user blocks it
    let latitude = null;
    let longitude = null;
    try {
      const pos = await getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch (err) {
      // user denied or timed out; we proceed without coordinates
      console.warn("Geolocation unavailable or denied:", err?.message || err);
    }

    try {
      const formData = new FormData();
      formData.append("image", image);
      formData.append("phone", phone);
      formData.append("language", language);
      if (latitude !== null) formData.append("latitude", latitude);
      if (longitude !== null) formData.append("longitude", longitude);

      const res = await axios.post(`${BACKEND}/api/agri/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });

      // Expect backend to return { disease, suggestion, location, temperature } (best-effort)
      const { disease, suggestion, location, temperature } = res.data || {};

      const finalResult =
        `${location ? `📍 स्थान: ${location}\n` : ""}${temperature ? `🌡 तापमान: ${temperature}\n\n` : ""}` +
        `${disease ? `🌿 रोग: ${String(disease).trim()}\n\n` : ""}` +
        `${suggestion ? `💡 सल्ला:\n${String(suggestion).trim()}` : "💡 कोई सल्ला उपलब्ध नहीं है।"}`;

      setResult(finalResult);
      // speak in selected language if available
      speakText(finalResult, language);
    } catch (err) {
      console.error("Analyze error:", err);
      const msg = err?.response?.data?.message || "❌ Failed to analyze image. Try again later.";
      setResult(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToWhatsApp = async () => {
    if (!isValidPhone(phone)) return alert("📱 Enter a valid WhatsApp number.");
    if (!result) return alert("🧠 Analyze an image first.");

    try {
      await axios.post(`${BACKEND}/api/agri/send`, {
        phone,
        message: result,
      });
      alert("✅ Message sent to WhatsApp!");
    } catch (err) {
      console.error("WhatsApp send error:", err?.response?.data || err?.message || err);
      alert("❌ Failed to send message to WhatsApp.");
    }
  };

  return (
    <div
      className="module-container"
      style={{
        backgroundImage: `url("/bg.jpg")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="glass-card" role="region" aria-label="Upload crop image">
        <h2>📷 Upload Crop Image</h2>

        <select
          className="glass-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
        >
          <option value="en">🇬🇧 English</option>
          <option value="hi">🇮🇳 Hindi</option>
          <option value="mr">🇮🇳 Marathi</option>
        </select>

        <input
          className="glass-input"
          type="text"
          placeholder="+91XXXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="WhatsApp phone number"
        />

        <div className="file-upload-wrapper" style={{ width: "100%", maxWidth: 360 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
            aria-hidden="true"
          />
          <div className="button-group">
            <button
              type="button"
              className="glass-file-button"
              onClick={handleChooseClick}
              aria-label="Choose image"
            >
              📁 Choose Image
            </button>

            <button
              type="button"
              className="glass-button"
              onClick={() => {
                // clear selection
                setImage(null);
                if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
                setPreview(DEFAULT_PREVIEW);
                setResult("");
                if (fileInputRef.current) fileInputRef.current.value = null;
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {preview && (
          <img
            src={preview}
            alt="preview"
            className="preview-img"
            style={{ maxWidth: 360, marginTop: 14 }}
          />
        )}

        <div className="button-group">
          <button
            onClick={handleSubmit}
            className="glass-button"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>

          <button onClick={handleSendToWhatsApp} className="glass-button" aria-label="Send to WhatsApp">
            📩 Send to WhatsApp
          </button>
        </div>

        {loading && <p className="result-text">⏳ Analyzing... please wait</p>}

        {result && (
          <>
            <pre
              className="glass-response"
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowY: "auto",
                maxHeight: "300px",
                marginTop: 14,
              }}
            >
              {result}
            </pre>

            <div className="button-group">
              <button onClick={() => speakText(result, language)} className="glass-button">
                🔊 Listen Again
              </button>
              <button onClick={() => window.speechSynthesis.cancel()} className="glass-button">
                ⛔ Stop Voice
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;
