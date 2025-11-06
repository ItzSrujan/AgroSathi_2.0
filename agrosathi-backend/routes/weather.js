const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;

// INPUT: { latitude, longitude }
// OUTPUT: weather data
router.post("/current", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Latitude & Longitude required" });
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;

    const response = await axios.get(url);

    const temperature = response.data.current_weather?.temperature;
    const weatherCode = response.data.current_weather?.weathercode;

    res.json({
      temperature,
      weatherCode
    });

  } catch (err) {
    console.log("Weather API Error:", err.message);
    res.status(500).json({ error: "Weather fetch failed" });
  }
});

module.exports = router;