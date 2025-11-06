require("dotenv").config();
const express = require("express");
const cors = require("cors");

const agriRoutes = require("./routes/agri");
const locationRoutes = require("./routes/location");
const weatherRoutes = require("./routes/weather");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/location", locationRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/agri", agriRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("✅ Backend running on port " + PORT));
