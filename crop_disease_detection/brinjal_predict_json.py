import argparse
import json
import os

import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

BRINJAL_MAIN_MODEL = os.path.join(MODELS_DIR, "brinjal_disease_model.keras")
BRINJAL_GATE_MODEL = os.path.join(MODELS_DIR, "brinjal2_model.keras")
BRINJAL_MAIN_CLASSES = os.path.join(MODELS_DIR, "brinjal_disease_class_names.json")
BRINJAL_GATE_CLASSES = os.path.join(MODELS_DIR, "brinjal2_class_names.json")


def _load_bundle(model_path, classes_path):
    model = tf.keras.models.load_model(model_path, compile=False)
    with open(classes_path, "r") as f:
        class_names = json.load(f)
    return {"model": model, "class_names": class_names, "model_path": model_path}


def _predict(bundle, img_batch):
    preds = bundle["model"].predict(img_batch, verbose=0)[0]
    idx = int(np.argmax(preds))
    return {
        "model_name": os.path.basename(bundle["model_path"]),
        "predicted_class": bundle["class_names"][idx],
        "predicted_index": idx,
        "confidence": round(float(preds[idx]) * 100, 2),
        "scores": [round(float(x) * 100, 2) for x in preds],
    }


def _predict_sequential(main_bundle, gate_bundle, img_batch):
    main_result = _predict(main_bundle, img_batch)

    if main_result["confidence"] < 20.0:
        return {
            "success": False,
            "error": "The uploaded image could not be identified. Please upload a clearer Brinjal leaf image.",
            "model_results": [main_result],
        }

    if main_result["predicted_class"] != "Healthy Brinjal":
        return {
            "success": True,
            "final": main_result,
            "model_results": [main_result],
        }

    gate_result = _predict(gate_bundle, img_batch)
    if gate_result["predicted_class"] == "Brinjal Little Leaf" and gate_result["confidence"] >= 20.0:
        return {
            "success": True,
            "final": gate_result,
            "model_results": [main_result, gate_result],
        }

    return {
        "success": True,
        "final": main_result,
        "model_results": [main_result, gate_result],
    }


def main():
    parser = argparse.ArgumentParser(description="Predict brinjal disease and return JSON.")
    parser.add_argument("image_path", type=str, help="Path to the uploaded image")
    args = parser.parse_args()

    if not os.path.exists(args.image_path):
        raise FileNotFoundError(f"Image not found: {args.image_path}")

    img = image.load_img(args.image_path, target_size=(224, 224))
    img_batch = np.expand_dims(image.img_to_array(img) / 255.0, axis=0)

    main_bundle = _load_bundle(BRINJAL_MAIN_MODEL, BRINJAL_MAIN_CLASSES)
    gate_bundle = _load_bundle(BRINJAL_GATE_MODEL, BRINJAL_GATE_CLASSES)

    result = _predict_sequential(main_bundle, gate_bundle, img_batch)
    if not result["success"]:
        print(json.dumps(result))
        return

    output = {
        "success": True,
        "crop": "Brinjal",
        "disease": result["final"]["predicted_class"],
        "confidence": result["final"]["confidence"],
        "model_results": result["model_results"],
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
