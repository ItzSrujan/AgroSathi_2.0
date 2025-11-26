import React, { useEffect, useState } from "react";
import GradientText from "../components/GradientText";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();

  const [locationName, setLocationName] = useState("Fetching...");
  const [temperature, setTemperature] = useState("--°C");

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;

          fetchLocation(latitude, longitude);
          fetchWeather(latitude, longitude);
        },
        () => {
          setLocationName("Location Permission Denied");
          setTemperature("--°C");
        }
      );
    } else {
      setLocationName("Geolocation Not Supported");
    }
  }, []);

  const fetchLocation = async (latitude, longitude) => {
    try {
      const res = await fetch(`http://localhost:8080/api/location/get-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude })
      });

      const data = await res.json();
      setLocationName(data.location || "Unknown City");
    } catch {
      setLocationName("Unknown City");
    }
  };


  const fetchWeather = async (latitude, longitude) => {
    try {
      const res = await fetch(`http://localhost:8080/api/weather/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude })
      });

      const data = await res.json();

      if (data.temperature) {
        setTemperature(Math.round(data.temperature) + "°C");
      }
    } catch {
      setTemperature("--°C");
    }
  };


  return (
    <div className="hero" style={{
      backgroundImage: `url("/bg.jpg")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}>

      <div className="weather-widget">
        <div className="location">📍 {locationName}</div>
        <div className="temp">{temperature}</div>
      </div>

      <div className="overlay"></div>

      <div className="content">
        <GradientText
          colors={["#ffffff", "#40ffaa", "#ffffff", "#40ffaa", "#ffffff"]}
          animationSpeed={6}
          showBorder={false}
          className="custom-class"
        >
          AGROSATHI
        </GradientText>

        <div className="subtitle">Empowering Farmers with AI Wisdom</div>

        <div className="buttons">
          <button onClick={() => navigate("/voice")}>🎤 Ask Voice</button>
          <button onClick={() => navigate("/upload")}>📷 Upload Image</button>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
