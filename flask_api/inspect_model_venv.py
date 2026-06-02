import joblib
import pickle

model_path = 'd:/ImageToPDF/theme_model.pkl'

print("Trying joblib...")
try:
    model = joblib.load(model_path)
    print("Joblib loaded. Type:", type(model))
    if hasattr(model, 'predict'):
        print("Prediction test:", model.predict(["Hello world"]))
except Exception as e:
    print("Joblib error:", e)

print("Trying pickle...")
try:
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
        print("Pickle loaded. Type:", type(model))
except Exception as e:
    print("Pickle error:", e)
