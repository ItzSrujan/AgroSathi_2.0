🌾 AgroSathi — AI-Powered Rural Companion for Smart Farming

AgroSathi is a multilingual, AI-integrated smart farming assistant that helps farmers detect plant diseases from images and get personalized voice/text-based agricultural advice in native Indian languages like Marathi and Hindi. It also supports WhatsApp delivery and contextual advice based on local weather and location.

📁 Project Structure
AgroSathi/
├── agrosathi/              # React frontend (runs separately)
├── agrosathi-backend/      # Node.js + Express backend (runs separately)
├── agrosathi-model-main/   # Flask + TFLite ML API (runs separately)
└── README.md               # this file

🧠 Features

📸 Image-based Plant Disease Detection using a TFLite model.

🎤 Voice query (ASR → intent → reply) with AI-generated farming advice (OpenRouter / other LLM + Google TTS).

🌐 Multilingual: English, Marathi, Hindi (UI + voice outputs).

🔔 WhatsApp message delivery for farmers (Twilio or WhatsApp Cloud API).

🌦️ Location + Weather-aware advice (uses geolocation + weather API).

🤖 Chatbot for follow-up Q&A and action recommendations.

✅ Removed: marketplace and confidence-score UI elements (not shipped).

🚀 How to Run Locally

Each service runs independently. Start them in separate terminals.

1. Clone the repo
git clone https://github.com/ItzSrujan/AgroSathi_2.0.git
cd AgroSathi_2.0

2. Start ML Model Server (Flask + TFLite)
cd agrosathi-model-main
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py               # default: http://localhost:5000


Make sure model.tflite is placed inside agrosathi-model-main.

Required endpoints (example):

POST /predict-image — accepts multipart/form-data (image) and returns:

{
  "disease": "Leaf Blight",
  "suggestion": "Apply X ...",
  "location": "Pune, India",
  "temperature": 28.4
}

3. Start Backend (Node.js + Express)
cd ../agrosathi-backend
npm install
# create .env (see sample below)
npm run dev   # or `node App.js`
# default: http://localhost:8080

Key endpoints (backend):

POST /api/weather/current — { latitude, longitude } → returns { temp, condition, location }.

POST /api/agri/image — accepts form-data (image + meta) → calls ML model and returns formatted advice.

POST /api/agri/voice — accepts { query, language } → returns { reply }.

POST /api/agri/send — { phone, message } → sends WhatsApp message (Twilio/Meta).

4. Start Frontend (React)
cd ../agrosathi
npm install
# create .env: REACT_APP_BACKEND_URL=http://localhost:8080
npm start
# opens at http://localhost:3000


Note: background image is set in the React component; remove background from CSS if you previously duplicated it.

📱 WhatsApp Integration

How it works:

After an image or voice query, the backend generates a human-friendly message (disease + localized advice) and calls the configured WhatsApp provider to send it to the farmer’s number.

Supported providers:

Twilio WhatsApp (recommended for quick testing) — uses Twilio sandbox (verified numbers required).

Meta WhatsApp Cloud API — requires Facebook app, phone number ID and a token.

Twilio Example (Node snippet):

const client = require('twilio')(SID, TOKEN);
client.messages.create({
  from: process.env.TWILIO_WHATSAPP_NUMBER,
  to: `whatsapp:${phone}`,
  body: message
});


Important caveats

Twilio Sandbox requires that target numbers are added as sandbox testers; otherwise the message won’t reach them.

Keep messages short (<1600 chars ideal) to avoid multi-message fragmentation.

🗺️ Location & Weather-based Advice

Frontend asks for browser geolocation (user permission required).

Backend uses lat/long to call a weather provider (e.g., OpenWeatherMap) and optionally a geocoding API to get a readable location (city/district).

Advice examples:

If heavy rain predicted → delay spraying and suggest drainage.

If high temperature → irrigation + mulching recommendations.

The ML model output is combined with location + weather to produce context-aware suggestions returned to the UI and WhatsApp.

Tip: If you see Local instead of actual city, map the weather provider’s returned fields to the location property the frontend expects (or adjust the frontend to use the provider’s location field).

💬 Chatbot Integration

Single /api/agri/voice route can be used for typed chat too: send text + language → receive assistant reply (OpenRouter or other LLM).

Chatbot flow:

User types or speaks.

Frontend forwards text to backend.

Backend formats a prompt (includes recent chat history if available + user language).

Backend calls OpenRouter / OpenAI-compatible API.

Backend returns the bot reply, and optionally creates a short action plan (7-day plan) for farmers.

Frontend behavior:

Chat history scrolls automatically.

Bot replies may include headers and bullets — rendered with renderMessage (already in the frontend code).

The ML model may still return probabilities — backend must format or discard them; do not expose raw confidence score to the frontend unless explicitly desired.

Make sure the backend maps the model response keys to what the frontend expects (disease, suggestion, location, temperature).

🔐 Environment Variables (summary)

agrosathi-backend/.env (example)

PORT=8080
MODEL_SERVICE_URL=http://localhost:5000
WEATHER_API_KEY=XXXXXXXX
GEOCODING_API_KEY=XXXXX
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_NUMBER=whatsapp:+1415...


agrosathi/.env

REACT_APP_BACKEND_URL=http://localhost:8080


agrosathi-model-main/.env

PORT=5000
MODEL_PATH=./model.tflite

✍️ Example Sample Message (WhatsApp)
🌾 AgroSathi Plant Diagnosis Report 🌿

🩺 Detected Disease: Leaf Blight
💡 Advice: Apply copper-based fungicide early morning. Remove infected leaves; keep foliage dry.

7-day Action Plan:
Day1: Apply treatment...
Day2: Inspect...
...
Language: Marathi

🐞 Troubleshooting

Local shown instead of city name
Map the weather provider’s location field to location in backend. For OpenWeather, res.data.name is the city. Ensure backend returns location key the frontend expects.

CORS issues
Enable CORS in backend: npm install cors and app.use(require('cors')()).

Push to GitHub — remote already exists
If error: remote origin already exists:

git remote remove origin
git remote add origin https://github.com/ItzSrujan/AgroSathi_2.0.git
git push -u origin main


Or update URL:

git remote set-url origin https://github.com/ItzSrujan/AgroSathi_2.0.git


WhatsApp not delivered (Twilio Sandbox)
Add target phone number to Twilio sandbox and follow Twilio instructions (send JOIN code from the farmer's WhatsApp to Twilio sandbox number).

📦 Deployment suggestions

Frontend: Vercel / Netlify (set REACT_APP_BACKEND_URL to production backend).

Backend: Heroku / Railway / DigitalOcean App Platform (secure env vars).

ML model: Dockerize agrosathi-model-main and host on a machine with appropriate resources (Dockerfile included).

🧑‍🌾 Credits & Contact

Team: mayurpatiltae

Mayur Patil — Full-stack + ML integration

Trinity Academy of Engineering

Contact: 9767550382
