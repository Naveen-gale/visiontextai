import pickle
import sys

try:
    with open('d:/ImageToPDF/theme_model.pkl', 'rb') as f:
        model = pickle.load(f)
        print("Model type:", type(model))
        if hasattr(model, 'classes_'):
            print("Classes:", model.classes_)
        if hasattr(model, 'predict'):
            print("Has predict method")
            
        print("Model object:", model)
except Exception as e:
    print("Error:", e)
