import os
import joblib
from flask import Flask, request, jsonify

app = Flask(__name__)

# Resolve model path with fallbacks for Render environment
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

possible_paths = [
    os.environ.get("THEME_MODEL_PATH"),
    os.path.join(BASE_DIR, "theme_model.pkl"),
    os.path.join(BASE_DIR, "..", "theme_model.pkl")
]

MODEL_PATH = None
for p in possible_paths:
    if p and os.path.exists(p):
        MODEL_PATH = p
        break

if not MODEL_PATH:
    # Default to current dir if none found, for logging
    MODEL_PATH = os.path.join(BASE_DIR, "theme_model.pkl")

# Theme model
model = None
model_load_attempted = False
model_load_error = None

# Structure model
STRUCTURE_MODEL_PATH = os.environ.get("STRUCTURE_MODEL_PATH") or os.path.join(BASE_DIR, "topics_structures.pkl")
structure_model = None
structure_model_load_attempted = False
structure_model_load_error = None

def get_model():
    global model, model_load_attempted, model_load_error
    if not model_load_attempted:
        model_load_attempted = True
        try:
            print(f"Attempting to load model from {MODEL_PATH}")
            model = joblib.load(MODEL_PATH)
            print(f"Model loaded successfully from {MODEL_PATH}")
        except Exception as e:
            model_load_error = str(e)
            print(f"Warning: Failed to load model from {MODEL_PATH}. Error: {e}")
    return model

def get_structure_model():
    global structure_model, structure_model_load_attempted, structure_model_load_error
    if not structure_model_load_attempted:
        structure_model_load_attempted = True
        try:
            print(f"Attempting to load structure model from {STRUCTURE_MODEL_PATH}")
            structure_model = joblib.load(STRUCTURE_MODEL_PATH)
            print(f"Structure model loaded successfully from {STRUCTURE_MODEL_PATH}")
        except Exception as e:
            structure_model_load_error = str(e)
            print(f"Warning: Failed to load structure model from {STRUCTURE_MODEL_PATH}. Error: {e}")
    return structure_model

@app.route('/predict-theme', methods=['POST'])
def predict_theme():
    m = get_model()
    if m is None:
        return jsonify({"error": f"Model not loaded properly. Path: {MODEL_PATH}, Error: {model_load_error}"}), 500

    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = data['prompt']
    
    try:
        # The pipeline expects a list of strings
        prediction = m.predict([prompt])
        # It returns a numpy array, we want the first element
        theme_name = str(prediction[0])
        return jsonify({
            "success": True,
            "theme": theme_name
        })
    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

@app.route('/predict-structure', methods=['POST'])
def predict_structure():
    m = get_structure_model()
    if m is None:
        return jsonify({"error": f"Structure model not loaded properly. Path: {STRUCTURE_MODEL_PATH}, Error: {structure_model_load_error}"}), 500

    data = request.get_json()
    if not data or 'prompt' not in data:
        return jsonify({"error": "No prompt provided"}), 400

    prompt = data['prompt']
    
    try:
        prediction = m.predict([prompt])
        structure_name = str(prediction[0])
        return jsonify({
            "success": True,
            "structure": structure_name
        })
    except Exception as e:
        return jsonify({"error": f"Structure prediction failed: {str(e)}"}), 500

@app.route('/health', methods=['GET'])
def health():
    # Calling get_model() on health check will trigger the load if not already loaded,
    # but to keep health check fast, we just report if it's currently loaded.
    return jsonify({
        "status": "ok", 
        "model_loaded": model is not None,
        "load_attempted": model_load_attempted,
        "load_error": model_load_error,
        "structure_model_loaded": structure_model is not None,
        "structure_load_attempted": structure_model_load_attempted,
        "structure_load_error": structure_model_load_error
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port)
