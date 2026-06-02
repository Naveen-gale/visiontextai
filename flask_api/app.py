import os
import joblib
from flask import Flask, request, jsonify

app = Flask(__name__)

# Resolve model path. Assumes model is in the root directory 'd:/ImageToPDF' or relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.environ.get("THEME_MODEL_PATH", os.path.join(BASE_DIR, "..", "theme_model.pkl"))

model = None

try:
    model = joblib.load(MODEL_PATH)
    print(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"Warning: Failed to load model from {MODEL_PATH}. Error: {e}")

@app.route('/predict-theme', methods=['POST'])
def predict_theme():
    if model is None:
        return jsonify({"error": "Model not loaded properly. Please check logs."}), 500

    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = data['prompt']
    
    try:
        # The pipeline expects a list of strings
        prediction = model.predict([prompt])
        # It returns a numpy array, we want the first element
        theme_name = str(prediction[0])
        return jsonify({
            "success": True,
            "theme": theme_name
        })
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port)
