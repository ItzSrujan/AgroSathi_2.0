from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import os
import requests

# ✅ Class label map
label_map = {
  0: "Apple___Apple_scab",
  1: "Apple___Black_rot",
  2: "Apple___Cedar_apple_rust",
  3: "Apple___healthy",
  4: "Blueberry___healthy",
  5: "Cherry_(including_sour)___Powdery_mildew",
  6: "Cherry_(including_sour)___healthy",
  7: "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
  8: "Corn_(maize)___Common_rust_",
  9: "Corn_(maize)___Northern_Leaf_Blight",
  10: "Corn_(maize)___healthy",
  11: "Grape___Black_rot",
  12: "Grape___Esca_(Black_Measles)",
  13: "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
  14: "Grape___healthy",
  15: "Orange___Haunglongbing_(Citrus_greening)",
  16: "Peach___Bacterial_spot",
  17: "Peach___healthy",
  18: "Pepper,_bell___Bacterial_spot",
  19: "Pepper,_bell___healthy",
  20: "Potato___Early_blight",
  21: "Potato___Late_blight",
  22: "Potato___healthy",
  23: "Raspberry___healthy",
  24: "Soybean___healthy",
  25: "Squash___Powdery_mildew",
  26: "Strawberry___Leaf_scorch",
  27: "Strawberry___healthy",
  28: "Tomato___Bacterial_spot",
  29: "Tomato___Early_blight",
  30: "Tomato___Late_blight",
  31: "Tomato___Leaf_Mold",
  32: "Tomato___Septoria_leaf_spot",
  33: "Tomato___Spider_mites Two-spotted_spider_mite",
  34: "Tomato___Target_Spot",
  35: "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
  36: "Tomato___Tomato_mosaic_virus",
  37: "Tomato___healthy"
}

# 💡 Suggestions Map
suggestions = {
    "Apple___Apple_scab": "Use fungicides like captan or sulfur. Remove infected leaves.",
    "Apple___Black_rot": "Prune infected branches. Use fungicides.",
    "Apple___Cedar_apple_rust": "Remove nearby cedar trees. Use resistant varieties.",
    "Apple___healthy": "Your apple tree is healthy! Maintain regular watering.",
    "Blueberry___healthy": "Your blueberry plant is healthy. Keep soil acidic.",
    "Cherry_(including_sour)___Powdery_mildew": "Use sulfur-based fungicides. Prune for air circulation.",
    "Cherry_(including_sour)___healthy": "Healthy cherry tree! Ensure good drainage.",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Use resistant hybrids. Rotate crops.",
    "Corn_(maize)___Common_rust_": "Plant resistant varieties. Apply fungicides if severe.",
    "Corn_(maize)___Northern_Leaf_Blight": "Use resistant hybrids. Manage residue.",
    "Corn_(maize)___healthy": "Healthy corn! Keep monitoring for pests.",
    "Grape___Black_rot": "Remove mummified berries. Use fungicides.",
    "Grape___Esca_(Black_Measles)": "Prune infected parts. No cure, prevention is key.",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Use fungicides. Improve air circulation.",
    "Grape___healthy": "Healthy grapes! Prune regularly.",
    "Orange___Haunglongbing_(Citrus_greening)": "Remove infected trees. Control psyllids.",
    "Peach___Bacterial_spot": "Use copper sprays. Plant resistant varieties.",
    "Peach___healthy": "Healthy peach tree! Fertilize in spring.",
    "Pepper,_bell___Bacterial_spot": "Use copper sprays. Remove infected plants.",
    "Pepper,_bell___healthy": "Healthy peppers! Water consistently.",
    "Potato___Early_blight": "Use fungicides. Rotate crops.",
    "Potato___Late_blight": "Destroy infected plants immediately. Use fungicides.",
    "Potato___healthy": "Healthy potatoes! Hill soil around plants.",
    "Raspberry___healthy": "Healthy raspberries! Prune old canes.",
    "Soybean___healthy": "Healthy soybeans! Monitor for pests.",
    "Squash___Powdery_mildew": "Use neem oil or sulfur. Water at base.",
    "Strawberry___Leaf_scorch": "Remove infected leaves. Improve drainage.",
    "Strawberry___healthy": "Healthy strawberries! Mulch to keep berries clean.",
    "Tomato___Bacterial_spot": "Use copper sprays. Avoid overhead watering.",
    "Tomato___Early_blight": "Mulch soil. Use fungicides like chlorothalonil.",
    "Tomato___Late_blight": "Remove infected plants. Use copper fungicides.",
    "Tomato___Leaf_Mold": "Improve air circulation. Water at base.",
    "Tomato___Septoria_leaf_spot": "Remove lower leaves. Use fungicides.",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Use insecticidal soap or neem oil.",
    "Tomato___Target_Spot": "Use fungicides. Improve air circulation.",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Control whiteflies. Remove infected plants.",
    "Tomato___Tomato_mosaic_virus": "Remove infected plants. Wash hands after handling tobacco.",
    "Tomato___healthy": "Your tomato plant is healthy! Keep up the good work."
}

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.tflite")

# 🔍 Load .tflite model
interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# ⚙️ Image Preprocessing
def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize((224, 224))  # Must match model input shape
    img_array = np.array(image, dtype=np.float32)
    img_array = img_array / 255.0  # Normalize
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

def get_weather(lat, lon):
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
        response = requests.get(url)
        data = response.json()
        temp = data["current_weather"]["temperature"]
        return f"{temp}°C"
    except Exception as e:
        print(f"Weather error: {e}")
        return "Unknown"

# 🔍 Prediction Endpoint
@app.route("/api/agri/image", methods=["POST"])
def analyze_image():
    if "image" not in request.files:    
        return jsonify({"error": "No image uploaded"}), 400

    image_file = request.files["image"]
    image_bytes = image_file.read()
    
    # Get location from form data
    lat = request.form.get("latitude", 20.5937) # Default to India center
    lon = request.form.get("longitude", 78.9629)

    # Predict
    input_data = preprocess_image(image_bytes)
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    output_data = interpreter.get_tensor(output_details[0]['index'])

    predicted_index = int(np.argmax(output_data))
    raw_name = label_map.get(predicted_index, "Unknown")
    
    # Format result
    suggestion = suggestions.get(raw_name, "Consult a local agronomist.")
    weather = get_weather(lat, lon)
    
    # Clean name
    display_name = raw_name.replace("___", " - ").replace("_", " ")

    return jsonify({
        "disease": display_name,
        "suggestion": suggestion,
        "location": f"{lat}, {lon}",
        "temperature": weather
    })

@app.route("/api/agri/send", methods=["POST"])
def send_whatsapp():
    # Mock WhatsApp sending
    data = request.json
    print(f"Sending WhatsApp to {data.get('phone')}: {data.get('message')}")
    return jsonify({"status": "success", "message": "Message sent successfully"})

# 🌤️ Weather Endpoint
@app.route("/api/weather/current", methods=["POST"])
def current_weather():
    data = request.json
    lat = data.get("latitude")
    lon = data.get("longitude")

    if not lat or not lon:
        return jsonify({"error": "Location required"}), 400

    try:
        # 1. Get Weather
        weather_url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
        w_res = requests.get(weather_url).json()
        current = w_res.get("current_weather", {})
        
        temp = int(round(current.get("temperature")))
        code = current.get("weathercode")
        
        # Interpret code
        condition = "Clear"
        if code in [1, 2, 3]: condition = "Partly Cloudy"
        elif code in [45, 48]: condition = "Foggy"
        elif code in [51, 53, 55, 61, 63, 65]: condition = "Rainy"
        elif code in [71, 73, 75]: condition = "Snowy"
        elif code in [95, 96, 99]: condition = "Thunderstorm"

        # 2. Get Location Name (Reverse Geocoding)
        # Note: Nominatim requires a User-Agent
        geo_url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
        headers = {'User-Agent': 'AgroSathiApp/1.0'}
        g_res = requests.get(geo_url, headers=headers).json()
        
        address = g_res.get("address", {})
        # Try multiple fields for a valid city/town name
        city = address.get("city") or address.get("town") or address.get("village") or address.get("county") or "Unknown Location"
        state = address.get("state", "")
        
        location_name = f"{city}, {state}" if state else city

        return jsonify({
            "temp": temp,
            "condition": condition,
            "location": location_name,
            "weathercode": code
        })

    except Exception as e:
        print(f"Weather API Error: {e}")
        return jsonify({"error": "Failed to fetch weather"}), 500

# 🚀 Start Flask Server
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)