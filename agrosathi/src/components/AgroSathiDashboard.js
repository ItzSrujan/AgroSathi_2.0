import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AgroSathiDashboard.css';

const DICT = {
  en: {
    title: 'AgroSathi — Farmer Dashboard',
    upload: 'Upload Leaf Image',
    voice: 'Voice Assistant',
    weather: 'Local Weather',
    msp: 'Minimum Support Price (MSP)',
    advice: 'Smart Advice',
    language: 'Language',
    loading: 'Loading...'
  },
  hi: {
    title: 'AgroSathi — किसान डैशबोर्ड',
    upload: 'पत्ती की छवि अपलोड करें',
    voice: 'आवाज़ सहायक',
    weather: 'स्थानीय मौसम',
    msp: 'न्यूनतम समर्थन मूल्य (MSP)',
    advice: 'स्मार्ट सलाह',
    language: 'भाषा',
    loading: 'लोड हो रहा है...'
  }
};

// --- helper renderers (unchanged) ---
function parseInline(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderMessage(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: '8px' }} />;

    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.replace(/^#+\s*/, '');
      const fontSize = level === 1 ? '1.25em' : level === 2 ? '1.15em' : '1.05em';
      return (
        <strong key={i} style={{ display: 'block', fontSize, marginTop: '12px', marginBottom: '6px', color: '#40ffaa' }}>
          {parseInline(content)}
        </strong>
      );
    }

    if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      const content = trimmed.replace(/^[\*\-•]\s*/, '');
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginLeft: '8px', marginBottom: '4px' }}>
          <span style={{ marginRight: '8px', color: '#40ffaa', lineHeight: '1.5' }}>•</span>
          <span style={{ lineHeight: '1.5', flex: 1 }}>{parseInline(content)}</span>
        </div>
      );
    }

    if (trimmed.match(/^[\w\s]+:$/) && trimmed.length < 50) {
      return <strong key={i} style={{ display: 'block', marginTop: '8px', marginBottom: '4px', color: '#fff' }}>{parseInline(trimmed)}</strong>;
    }

    return <div key={i} style={{ marginBottom: '4px', lineHeight: '1.5' }}>{parseInline(line)}</div>;
  });
}

// --- component ---
export default function AgroSathiDashboard() {
  const [lang, setLang] = useState('en');
  const t = (k) => (DICT[lang] && DICT[lang][k]) || DICT.en[k] || k;
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null); // { temp, condition, location }
  const [advice, setAdvice] = useState('');
  const [loadingWeather, setLoadingWeather] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const chatRef = useRef(null);

  const mspData = [
    { crop: 'Wheat', price: '₹2,125/q' },
    { crop: 'Paddy', price: '₹2,040/q' },
    { crop: 'Maize', price: '₹1,962/q' },
    { crop: 'Cotton', price: '₹6,080/q' },
    { crop: 'Soybean', price: '₹4,300/q' }
  ];

  useEffect(() => {
    async function reverseGeocode(lat, lon) {
      try {
        // Public Nominatim endpoint. MAY require a proxy because of CORS.
        const nomUrl = 'https://nominatim.openstreetmap.org/reverse';
        const res = await axios.get(nomUrl, {
          params: {
            format: 'jsonv2',
            lat,
            lon,
            addressdetails: 1,
          },
          headers: {
            // identify your app (politeness header); optional but recommended
            'Accept-Language': lang === 'hi' ? 'hi' : 'en'
          },
          // NOTE: If your browser blocks CORS, use your backend proxy:
          // axios.get(`/api/geocode/reverse?lat=${lat}&lon=${lon}`)
        });
        // console.log('nominatim', res.data);
        const addr = res.data?.address || {};
        const place = addr.city || addr.town || addr.village || addr.hamlet || addr.county || addr.state || res.data?.display_name || '';
        return place || '';
      } catch (err) {
        console.warn('Reverse geocode failed:', err?.message || err);
        return '';
      }
    }

    async function fetchWeather() {
      setLoadingWeather(true);
      try {
        if (!navigator.geolocation) {
          setLoadingWeather(false);
          setAdvice('Geolocation not supported.');
          return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          try {
            const res = await axios.post('http://localhost:8080/api/weather/current', { latitude: lat, longitude: lon });
            console.log('raw weather response:', res.data);

            const raw = res.data || {};

            // temperature extraction
            const temp =
              raw.temp ??
              raw.temperature ??
              raw.current?.temp ??
              raw.current?.temperature ??
              raw.main?.temp ??
              (raw.weather && typeof raw.weather === 'object' && raw.weather.temp) ??
              null;

            // condition extraction
            let cond = '';
            if (raw.condition) cond = raw.condition;
            else if (raw.weather) {
              if (typeof raw.weather === 'string') cond = raw.weather;
              else if (Array.isArray(raw.weather) && raw.weather[0]) cond = raw.weather[0].description || raw.weather[0].main || '';
              else if (raw.current?.weather && Array.isArray(raw.current.weather)) cond = raw.current.weather[0]?.description || raw.current.weather[0]?.main || '';
            } else if (raw.description) cond = raw.description;

            cond = (cond || '').toString();

            // try many location fields first
            let location =
              raw.location ||
              raw.name ||
              raw.city ||
              raw.region ||
              raw.place ||
              raw.address ||
              raw.timezone ||
              (raw.location && (raw.location.name || raw.location.city)) ||
              (raw.current && (raw.current.location || raw.current.city)) ||
              '';

            // If no location found, fallback to reverse geocode using lat/lon
            if (!location) {
              const rg = await reverseGeocode(lat, lon);
              location = rg || 'Local';
            }

            const normalized = {
              temp: temp !== undefined && temp !== null ? temp : null,
              condition: cond || '',
              location: location || 'Local'
            };

            setWeather(normalized);
            generateAdvice(normalized);
          } catch (err) {
            console.error('Weather API Error:', err?.response?.data || err.message || err);
            // try reverse geocode anyway to display something
            const fallbackPlace = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            setWeather({ temp: null, condition: '', location: fallbackPlace || 'Local' });
            setAdvice('Could not fetch local weather.');
          } finally {
            setLoadingWeather(false);
          }
        }, (err) => {
          console.error('Geolocation error:', err);
          setLoadingWeather(false);
          setAdvice('Location access denied. Cannot fetch weather.');
        }, { timeout: 10000 });
      } catch (e) {
        console.error('fetchWeather failed:', e);
        setLoadingWeather(false);
      }
    }

    function generateAdvice(w) {
      let line1 = 'Weather looks good for field work.';
      let line2 = 'Ensure proper irrigation.';
      if (w) {
        const temp = parseFloat(w.temp);
        const cond = (w.condition || '').toLowerCase();
        if (cond.includes('rain')) {
          line1 = 'Heavy rain expected. Delay sowing and ensure drainage.';
          line2 = 'Avoid applying pesticides today.';
        } else if (!isNaN(temp) && temp > 35) {
          line1 = 'High temperature detected. Irrigate crops frequently.';
          line2 = 'Mulch soil to retain moisture.';
        } else if (!isNaN(temp) && temp < 15) {
          line1 = 'Low temperature. Protect sensitive crops from frost.';
          line2 = 'Consider light irrigation in the evening.';
        }
      }
      setAdvice(`${line1}\n${line2}`);
    }

    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatHistory]);

  async function handleChatSend() {
    if (!chatInput.trim()) return;
    const userMsg = { from: 'user', text: chatInput };
    setChatHistory((h) => [...h, userMsg]);
    setChatInput('');
    const loadingMsg = { from: 'bot', text: '...' };
    setChatHistory((h) => [...h, loadingMsg]);

    try {
      const res = await axios.post('http://localhost:8080/api/agri/voice', { query: userMsg.text, language: lang });
      setChatHistory((h) => {
        const newH = [...h];
        newH.pop();
        return [...newH, { from: 'bot', text: res.data.reply || "I didn't get that." }];
      });
    } catch (err) {
      console.error(err);
      setChatHistory((h) => {
        const newH = [...h];
        newH.pop();
        return [...newH, { from: 'bot', text: "Sorry, I'm having trouble connecting." }];
      });
    }
  }

  return (
    <div className="agro-dashboard-root" style={{ backgroundImage: 'url("/bg.jpg")' }}>
      <div className="agro-container">
        <header className="agro-header">
          <div className="brand">
            <span className="logo-icon">🌿</span>
            <h1>AgroSathi</h1>
          </div>

          <div className="header-actions">
            <div className="lang-wrapper">
              <span className="lang-icon">🌐</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)} className="glass-select">
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
          </div>
        </header>

        <main className="agro-grid-3col">
          <div className="col-left">
            <section className="card nav-card">
              <h2>Quick Actions</h2>
              <div className="nav-buttons">
                <button onClick={() => navigate('/upload')} className="btn glass-btn big-btn">📸 {t('upload')}</button>
                <button onClick={() => navigate('/voice')} className="btn glass-btn big-btn">🎤 {t('voice')}</button>
              </div>
            </section>

            <section className="card info-card">
              <h2>{t('weather')} & {t('advice')}</h2>
              <div className="weather-content">
                <div className="weather-summary">
                  {loadingWeather ? (
                    <p className="muted">{t('loading')}</p>
                  ) : weather ? (
                    <div className="weather-stack">
                      <div className="weather-main">
                        <span className="temp">{weather.temp !== null && weather.temp !== undefined ? Math.round(weather.temp) : '—'}°C</span>
                        <span className="cond">{weather.condition || ''}</span>
                      </div>
                      <div className="weather-loc">📍 {weather.location || 'Local'}</div>
                    </div>
                  ) : (
                    <p className="muted">Weather unavailable</p>
                  )}
                </div>
                <div className="advice-box"><p>{advice}</p></div>
              </div>
            </section>
          </div>

          <div className="col-center">
            <section className="card chat-card">
              <h2>🤖 AI Chatbot</h2>
              <div className="chatbox" ref={chatRef}>
                {chatHistory.length === 0 && <p className="muted" style={{ textAlign: 'center', marginTop: '20px' }}>Ask me anything about farming!</p>}
                {chatHistory.map((m, i) => (
                  <div key={i} className={`chat-msg ${m.from === 'user' ? 'user' : 'bot'}`}>{renderMessage(m.text)}</div>
                ))}
              </div>
              <div className="chat-controls">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} placeholder="Type your question..." />
                <button onClick={handleChatSend} className="send-btn">Send</button>
              </div>
            </section>
          </div>

          <div className="col-right">
            <section className="card msp-card">
              <h2>{t('msp')}</h2>
              <div className="msp-container">
                <table className="msp-table">
                  <thead>
                    <tr><th>Crop</th><th>Price</th></tr>
                  </thead>
                  <tbody>
                    {mspData.map((d, i) => (<tr key={i}><td>{d.crop}</td><td>{d.price}</td></tr>))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </main>

        <footer className="footer">AgroSathi Local Mode</footer>
      </div>
    </div>
  );
}
