require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const axios = require("axios");
const FormData = require("form-data");

const twilio = require("twilio");
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


// ✅ WhatsApp sender
const sendWhatsApp = async (to, message) => {
  try {
    const chunkSize = 1200; // WhatsApp safe limit
    const totalChunks = Math.ceil(message.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const part = message.substring(i * chunkSize, (i + 1) * chunkSize);

      await client.messages.create({
        body: `(${i + 1}/${totalChunks})\n\n${part}`,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${to}`,
      });

      // Small delay to avoid Twilio rate-limit errors
      await new Promise((res) => setTimeout(res, 1000));
    }

    console.log("✅ WhatsApp messages sent in chunks");
  } catch (error) {
    console.error("❌ WhatsApp error:", error.message);
  }
};

// ✅ AI Advice Generator
const generateAIAdvice = async (prompt) => {
  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini-2024-07-18",
        messages: [
          { role: "system", content: "You are AgroSathi, a helpful Indian agricultural assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 900,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("❌ OpenRouter AI Error:", err.message);
    return "⚠️ Could not generate advice. Please try again.";
  }
};

// 🎤 Voice Query Route
router.post("/voice", async (req, res) => {
  const { query, phone, language = "en" } = req.body;

  if (!query) return res.status(400).json({ error: "Query missing." });

  let prompt = `Farmer said: "${query}". Give complete farming advice including causes, symptoms, and treatment in simple rural Indian farmer-friendly language.`;

  if (language === "hi") {
    prompt = `किसान ने कहा: "${query}"। कृपया इस पर हिंदी में कृषि सलाह दें जिसमें कारण, लक्षण और उपचार शामिल हों। सरल और उपयोगी जानकारी दें।`;
  } else if (language === "mr") {
    prompt = `शेतकऱ्याने सांगितले: "${query}"। कृपया मराठीत सविस्तर कृषी सल्ला द्या – कारणे, लक्षणे आणि उपचार यांसह. सोपी आणि उपयोगी माहिती वापरा.`;
  }

  try {
    const aiReply = await generateAIAdvice(prompt);
    const fullMessage = `🧠 AgroSathi Suggestion:\n${aiReply}`;

    if (phone) await sendWhatsApp(phone, fullMessage);

    res.json({ reply: aiReply });
  } catch (err) {
    console.error("❌ Voice Route Error:", err.message);
    res.status(500).json({ error: "AI processing failed." });
  }
});

// 📸 Image Query Route (Real model + OpenRouter)
router.post("/image", upload.single("image"), async (req, res) => {
  const { phone, language = "en" } = req.body;
  const imageBuffer = req.file?.buffer;

  if (!imageBuffer) return res.status(400).json({ error: "No image provided." });

  // ✅ NEW: Read coordinates from frontend
  const latitude = parseFloat(req.body.latitude);
  const longitude = parseFloat(req.body.longitude);
  console.log("📍 Received Coordinates:", latitude, longitude);

  let result = {};

  // ✅ MODEL PREDICTION (UNCHANGED)
  try {
    const form = new FormData();
    form.append("image", imageBuffer, { filename: "plant.jpg" });

    const flaskRes = await axios.post(`${process.env.MODEL_URL}/predict`, form, {
      headers: form.getHeaders(),
    });

    console.log("🔍 Flask Result:", flaskRes.data);

    result.disease = flaskRes.data.class_name || "Unknown";
    result.confidence = flaskRes.data.confidence;

  } catch (err) {
    console.error("❌ ML Prediction Error:", err.message);
    return res.status(500).json({ error: "Image prediction failed." });
  }

  // ✅ NEW: Fetch City Name
  let city = "Unknown Area";
  try {
    const locRes = await axios.post(`/api/location/get-location`, {
    latitude, longitude
    });
    city = locRes.data.location || city;
  } catch (err) {
    console.log("❌ Location Error");
  }

  // ✅ NEW: Fetch Weather
 let temperature = "--°C";
try {
  const weatherRes = await axios.post(`/api/weather/current`, {
  latitude, longitude
});


  const temp =
    weatherRes.data?.currentConditions?.temperature ||
    weatherRes.data?.temperature ||
    weatherRes.data?.temp ||
    weatherRes.data?.days?.[0]?.temp ||
    null;

  temperature = temp ? Math.round(temp) + "°C" : "--°C";

} catch (err) {
  console.log("❌ Weather Error:", err.message);
}

  console.log(`🌍 City: ${city}, 🌡 Temp: ${temperature}`);

  // ✅ UPDATED PROMPT (keeping your same structure)
  // 🌐 Prompt based on language (UPDATED)
let prompt = `Location: ${city}
Temperature: ${temperature}
Disease: ${result.disease}

Explain in clear farmer-friendly language.
Do NOT use emojis.
Do NOT use bold, italic, bullet points, or markdown symbols.
Write only plain text.

Structure your answer like this:

Disease Name:
(Write name)

Symptoms:
(Explain simply)

Causes:
(Explain simply)

7-Day Treatment Plan:
Day 1 - 
Day 2 - 
Day 3 - 
Day 4 - 
Day 5 - 
Day 6 - 
Day 7 - 

Weather Considerations:
(Explain spray timing based on temperature and humidity)

Preventive Measures After Recovery:
(Explain simply)

Make the explanation detailed but easy to understand.
Do not shorten the response. Write full information.
`;

if (language === "hi") {
  prompt = `स्थान: ${city}
तापमान: ${temperature}
रोग: ${result.disease}

उत्तर किसान की भाषा में हो। 
कोई इमोजी नहीं। 
कोई ⭐, •, -, ** या _ जैसे संकेत नहीं। 
सिर्फ साधारण टेक्स्ट।

उत्तर का ढांचा:

रोग का नाम:
(सरल नाम लिखें)

लक्षण:
(सरल भाषा में)

कारण:
(सरल भाषा में)

7 दिन की उपचार योजना:
Day 1 -
Day 2 -
Day 3 -
Day 4 -
Day 5 -
Day 6 -
Day 7 -

मौसम आधारित सलाह:
(तापमान और नमी के अनुसार छिड़काव कब और कैसे)

रोकथाम:
(आगे क्या करना चाहिए)

उत्तर पूरा लिखें, बीच में बंद न करें।
`;
}

if (language === "mr") {
  prompt = `ठिकाण: ${city}
तापमान: ${temperature}
रोग: ${result.disease}

उत्तर शेतकऱ्याला समजेल अशा साध्या मराठीत द्या.
कोणतेही इमोजी वापरू नका.
कोणतेही **, __, -, किंवा बुलेट पॉइंट्स वापरू नका.
फक्त स्वच्छ साधा मजकूर.

उत्तराचे स्वरूप:

रोगाचे नाव:
(नाव)

लक्षणे:
(सोप्या भाषेत)

कारणे:
(सोप्या भाषेत)

7 दिवसांची उपचार योजना:
Day 1 -
Day 2 -
Day 3 -
Day 4 -
Day 5 -
Day 6 -
Day 7 -

हवामानानुसार सल्ला:
(तापमान / आर्द्रता लक्षात घेऊन फवारणीची वेळ)

प्रतिबंधक उपाय:
(शेतकऱ्याला करावयाची पुढील काळजी)

उत्तर पूर्ण लिहा, अर्धवट सोडू नका.
`;
}

  try {
    const aiAdvice = await generateAIAdvice(prompt);

    const fullMessage = `📍 ${city} | 🌡 ${temperature}\n🌿 ${result.disease}\n\n${aiAdvice}`;

    if (phone) await sendWhatsApp(phone, fullMessage);

    // ✅ NEW: send location + weather back to frontend
    res.json({
      disease: result.disease,
      confidence: result.confidence,
      location: city,
      temperature,
      suggestion: aiAdvice,
    });

  } catch (err) {
    console.error("❌ Advice Generation Error:", err.message);
    res.status(500).json({ error: "AI suggestion failed." });
  }
});

router.post("/send", async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: "Phone and message are required." });
  }

  try {
    await sendWhatsApp(phone, message);
    res.json({ success: true, message: "WhatsApp message sent successfully" });
  } catch (err) {
    console.error("❌ WhatsApp Send Route Error:", err.message);
    res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
});

module.exports = router;
