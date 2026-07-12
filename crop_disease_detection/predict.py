import argparse
import json
import os

import numpy as np
import tensorflow as tf
# pyrefly: ignore [missing-import]
from tensorflow.keras.preprocessing import image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

CROP_CONFIGS = {
    "Tomato": {
        "model_file": "tomato_disease_model.keras",
        "classes_file": "class_names.json",
        "input_mode": "raw",
        "input_size": (128, 128),
    },
    "Beans": {
        "model_file": "bean_disease_model.keras",
        "classes_file": "beans_class_names.json",
        "input_mode": "minus1to1",
    },
    "Papaya": {
        "model_file": "papaya_model.keras",
        "classes_file": "papaya_class_names.json",
        "input_mode": "minus1to1",
    },
    "Mango": {
        "model_file": "mango_model.keras",
        "classes_file": "mango_class_names.json",
        "input_mode": "minus1to1",
    },
    "Brinjal": {
        "model_files": ["brinjal_disease_model.keras", "brinjal2_model.keras"],
        "classes_files": ["brinjal_disease_class_names.json", "brinjal2_class_names.json"],
        "input_mode": "minus1to1",
        "input_size": (224, 224),
    },
    "Coconut": {
        "model_file": "coconut_disease_model.keras",
        "classes_file": "coconut_class_names.json",
        "input_mode": "raw",
    },
    "Paddy": {
        "model_file": "paddy_disease_model.keras",
        "classes_file": "paddy_class_names.json",
        "input_mode": "minus1to1",
    },
    "Green Chilli": {
        "model_file": "Chilli_model.keras",
        "classes_file": "chilli_class_names.json",
        "input_mode": "minus1to1",
    },
    "Chilli": {
        "model_file": "Chilli_model.keras",
        "classes_file": "chilli_class_names.json",
        "input_mode": "minus1to1",
    },
    "Lemon": {
        "model_file": "lemon_disease_model.keras",
        "classes_file": "lemon_class_names.json",
        "input_mode": "minus1to1",
    },
    "Turmeric": {
        "model_file": "turmeric_disease_model.keras",
        "classes_file": "turmeric_class_names.json",
        "input_mode": "minus1to1",
    },
    "Banana": {
        "model_file": "banana_model.keras",
        "classes_file": "banana_class_names.json",
        "input_mode": "minus1to1",
    },
    "Pumpkin": {
        "model_file": "pumpkin_disease_model.keras",
        "classes_file": "pumpkin_class_names.json",
        "input_mode": "minus1to1",
    }
}

DEFAULT_CROP = "Beans"


def _expected_input_size(model, fallback=(224, 224)):
    try:
        _, height, width, _ = model.input_shape
        if height and width:
            return int(height), int(width)
    except Exception:
        pass
    return fallback


def _expected_class_count(model):
    try:
        output_shape = model.output_shape
        if isinstance(output_shape, list):
            output_shape = output_shape[0]
        return int(output_shape[-1])
    except Exception:
        try:
            return int(getattr(model.layers[-1], "units"))
        except Exception:
            return None


def _uses_mobilenetv2_preprocessing(model):
    return any("expanded_conv" in layer.name for layer in model.layers)


def _has_builtin_preprocessing(model):
    return any(
        isinstance(layer, tf.keras.layers.Rescaling)
        or "preprocess" in layer.name.lower()
        for layer in model.layers
    )


def _load_classes(classes_path, expected_classes):
    if os.path.exists(classes_path):
        with open(classes_path, "r") as f:
            class_names = json.load(f)
        if expected_classes is not None and len(class_names) != expected_classes:
            raise ValueError(
                f"Model outputs {expected_classes} classes, but {classes_path} contains {len(class_names)} labels."
            )
        return class_names

    if expected_classes is None:
        return None

    return [f"class_{i}" for i in range(expected_classes)]


def _load_single_bundle(model_path, classes_path, input_mode="auto"):
    model = tf.keras.models.load_model(model_path, compile=False)

    expected_classes = _expected_class_count(model)
    class_names = _load_classes(classes_path, expected_classes)
    if class_names is None:
        raise ValueError(f"Unable to resolve class names from {classes_path}.")

    try:
        setattr(model, "_codex_input_mode", input_mode)
    except Exception:
        pass

    return {
        "model": model,
        "class_names": class_names,
        "model_path": model_path,
        "classes_path": classes_path,
        "input_mode": input_mode,
    }


def load_model_and_classes(crop_name=DEFAULT_CROP):
    """Load the trained model and class names for a selected crop."""
    if crop_name not in CROP_CONFIGS:
        raise ValueError(
            f"Unsupported crop type: {crop_name}. Available crops: {', '.join(CROP_CONFIGS)}"
        )

    config = CROP_CONFIGS[crop_name]
    if "model_files" in config:
        bundles = []
        for model_file, classes_file in zip(config["model_files"], config["classes_files"]):
            model_path = os.path.join(MODELS_DIR, model_file)
            classes_path = os.path.join(MODELS_DIR, classes_file)

            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model file not found at {model_path}. Please confirm the updated .keras file is in place."
                )

            bundles.append(_load_single_bundle(model_path, classes_path, config.get("input_mode", "auto")))

        return bundles, None

    model_path = os.path.join(MODELS_DIR, config["model_file"])
    classes_path = os.path.join(MODELS_DIR, config["classes_file"])

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at: {model_path}")

    bundle = _load_single_bundle(model_path, classes_path, config.get("input_mode", "auto"))
    return bundle["model"], bundle["class_names"]


def _predict_bundle(img_batch, bundle):
    model = bundle["model"]
    class_names = bundle["class_names"]

    input_mode = bundle.get("input_mode", getattr(model, "_codex_input_mode", "auto"))
    if input_mode == "raw":
        pass
    elif input_mode == "unit":
        img_batch = img_batch / 255.0
    elif input_mode == "minus1to1":
        img_batch = (img_batch / 127.5) - 1.0
    elif not _has_builtin_preprocessing(model):
        if _uses_mobilenetv2_preprocessing(model):
            img_batch = (img_batch / 127.5) - 1.0
        else:
            img_batch = img_batch / 255.0

    predictions = model.predict(img_batch, verbose=0)[0]
    predicted_class_idx = int(np.argmax(predictions))
    confidence = float(predictions[predicted_class_idx])
    predicted_disease = class_names[predicted_class_idx] if class_names else f"class_{predicted_class_idx}"

    return predicted_disease, round(min(100.0, max(0.0, confidence * 100)), 2)


def _predict_brinjal_sequential(bundles, img_batch):
    if not bundles:
        raise ValueError("No Brinjal predictions were produced.")

    primary_name, primary_confidence = _predict_bundle(img_batch.copy(), bundles[0])
    primary_output = {
        "model_name": os.path.basename(bundles[0]["model_path"]),
        "predicted_disease": primary_name,
        "confidence": primary_confidence,
    }

    if primary_confidence < 20.0:
        return {
            "error": "The uploaded image could not be identified. Please upload a clearer Brinjal leaf image.",
            "model_results": [primary_output],
        }

    if primary_name != "Healthy Brinjal" or len(bundles) < 2:
        return {
            "final_prediction": primary_output,
            "model_results": [primary_output],
        }

    secondary_name, secondary_confidence = _predict_bundle(img_batch.copy(), bundles[1])
    secondary_output = {
        "model_name": os.path.basename(bundles[1]["model_path"]),
        "predicted_disease": secondary_name,
        "confidence": secondary_confidence,
    }

    if secondary_name == "Brinjal Little Leaf" and secondary_confidence >= 20.0:
        return {
            "final_prediction": secondary_output,
            "model_results": [primary_output, secondary_output],
        }

    return {
        "final_prediction": primary_output,
        "model_results": [primary_output, secondary_output],
    }


def predict_image(img_path, model, class_names):
    """Predict the disease of a single image given its path."""
    if not os.path.exists(img_path):
        raise FileNotFoundError(f"Image not found at {img_path}")

    if isinstance(model, list):
        target_size = model[0].get("input_size", (224, 224))
    else:
        target_size = _expected_input_size(model)
    img = image.load_img(img_path, target_size=target_size)
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0)

    if isinstance(model, list):
        sequential = _predict_brinjal_sequential(model, img_array)
        if "error" in sequential:
            return sequential, sequential["model_results"]
        return sequential["final_prediction"], sequential["model_results"]

    disease, confidence = _predict_bundle(img_array, {"model": model, "class_names": class_names})
    return disease, confidence


def main():
    parser = argparse.ArgumentParser(description="Predict crop disease from an image.")
    parser.add_argument("image_path", type=str, help="Path to the input image for prediction")
    parser.add_argument(
        "--crop",
        type=str,
        default=DEFAULT_CROP,
        help="Crop model to use: Beans, Papaya, Mango, Brinjal, or Tomato",
    )
    args = parser.parse_args()

    try:
        print(f"Loading {args.crop} model and class names...")
        model, class_names = load_model_and_classes(args.crop)
        if isinstance(model, list):
            print(f"Loaded {len(model)} models successfully for {args.crop}.")
        else:
            print(f"Model loaded successfully. Recognizing {len(class_names)} diseases.")
        
        print(f"\nAnalyzing image: {args.image_path}")
        prediction = predict_image(args.image_path, model, class_names)
        
        print("\n--- Prediction Results ---")
        if isinstance(prediction, tuple) and len(prediction) == 2 and isinstance(prediction[1], list):
            final_prediction, all_results = prediction
            if isinstance(final_prediction, dict) and final_prediction.get("error"):
                print(f"Error: {final_prediction['error']}")
            else:
                print(f"Predicted Disease: {final_prediction['predicted_disease']}")
                print(f"Confidence:        {final_prediction['confidence']:.2f}%")
                print("")
                print("Model Breakdown:")
                for item in all_results:
                    print(f"Model:            {item['model_name']}")
                    print(f"Predicted Disease: {item['predicted_disease']}")
                    print(f"Confidence:        {item['confidence']:.2f}%")
                    print("")
        else:
            predicted_disease, confidence = prediction
            print(f"Predicted Disease: {predicted_disease}")
            print(f"Confidence:        {confidence:.2f}%")

    except Exception as e:
        print(f"Error during prediction: {e}")


if __name__ == "__main__":
    main()
