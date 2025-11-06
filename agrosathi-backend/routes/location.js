const express = require("express");
const axios = require("axios");
require("dotenv").config();

const router = express.Router();
const GEOCODING_API_KEY = process.env.GEOCODING_API_KEY;

router.post("/get-location", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Latitude & Longitude required" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GEOCODING_API_KEY}`;
    const response = await axios.get(url);

    const components = response.data.results?.[0]?.address_components || [];

    let city = null;

    // ✅ First priority: locality (true city)
    const locality = components.find(c => c.types.includes("locality"));
    if (locality) city = locality.long_name;

    // ✅ Second priority: sublocality (urban area)
    if (!city) {
      const sublocality = components.find(c => c.types.includes("sublocality"));
      if (sublocality) city = sublocality.long_name;
    }

    // ✅ Third fallback: district
    if (!city) {
      const district = components.find(c => c.types.includes("administrative_area_level_2"));
      if (district) city = district.long_name;
    }

    // ✅ Last fallback
    if (!city) city = "Unknown City";

    // ✅ Remove words like "District", "Division"
    city = city.replace(/ District| division| Division/gi, "").trim();

    return res.json({ location: city });

  } catch (err) {
    console.log("Reverse Geocoding Error:", err.response?.data || err.message);
    return res.status(500).json({ error: "Failed to determine city" });
  }
});

module.exports = router;
