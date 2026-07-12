import os
import numpy as np
import tensorflow as tf

def main():
    model_path = os.path.join('models', 'papaya_model.keras')
    print(f"Loading model: {model_path}")
    model = tf.keras.models.load_model(model_path)
    
    # Generate a random dummy image (e.g. noise or solid color)
    # Since we don't have the user's image, a random image usually produces somewhat balanced 
    # or low confidence, but if a scaling is completely wrong, it might produce 100% confidence.
    np.random.seed(42)
    dummy_img = np.random.uniform(0, 255, (1, 224, 224, 3)).astype(np.float32)
    
    print("\n--- Test 1: Raw [0, 255] ---")
    pred1 = model.predict(dummy_img, verbose=0)[0]
    print(f"Predictions: {pred1}")
    print(f"Max Confidence: {np.max(pred1)*100:.2f}%")

    print("\n--- Test 2: Scaled [0, 1] ---")
    pred2 = model.predict(dummy_img / 255.0, verbose=0)[0]
    print(f"Predictions: {pred2}")
    print(f"Max Confidence: {np.max(pred2)*100:.2f}%")
    
    print("\n--- Test 3: Scaled [-1, 1] (MobileNetV2 standard) ---")
    pred3 = model.predict((dummy_img / 127.5) - 1.0, verbose=0)[0]
    print(f"Predictions: {pred3}")
    print(f"Max Confidence: {np.max(pred3)*100:.2f}%")

if __name__ == "__main__":
    main()
