import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import VoiceInput from "./components/VoiceInput";
import ImageUpload from "./components/ImageUpload";
import AgroSathiDashboard from "./components/AgroSathiDashboard";  // ✅ Import dashboard

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AgroSathiDashboard />} />
        <Route path="/voice" element={<VoiceInput />} />
        <Route path="/upload" element={<ImageUpload />} />
        <Route path="/landing" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
