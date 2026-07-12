import os
import json
from django.conf import settings
import tensorflow as tf

# Caches for loaded models and class names
MODELS_CACHE = {}
CLASSES_CACHE = {}

# Scalable configuration for crops
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

def _get_model_dir():
    """
    Resolve the shared crop_disease_detection/models directory.
    Works both inside Django and when the module is imported directly.
    """
    try:
        base_dir = settings.BASE_DIR
        return os.path.join(os.path.dirname(base_dir), 'models')
    except Exception:
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        return os.path.join(project_root, 'models')


def _load_class_names(classes_path, expected_classes):
    if os.path.exists(classes_path):
        with open(classes_path, "r") as f:
            class_names = json.load(f)
        if expected_classes is not None and len(class_names) != expected_classes:
            raise ValueError(
                f"Model outputs {expected_classes} classes, but '{classes_path}' contains {len(class_names)} labels."
            )
        return class_names

    if expected_classes is None:
        return None

    return [f"class_{i}" for i in range(expected_classes)]


def _load_single_model(model_path, classes_path, crop_name, input_mode="auto"):
    model = tf.keras.models.load_model(model_path, compile=False)
    model._codex_input_mode = input_mode

    expected_classes = None
    try:
        output_shape = model.output_shape
        if isinstance(output_shape, list):
            output_shape = output_shape[0]
        expected_classes = int(output_shape[-1])
    except Exception:
        try:
            expected_classes = int(getattr(model.layers[-1], "units"))
        except Exception:
            expected_classes = None

    class_names = _load_class_names(classes_path, expected_classes)
    if class_names is None:
        return None, None, f"Unable to resolve class names for {crop_name} from '{classes_path}'."

    try:
        setattr(model, "_codex_input_mode", input_mode)
    except Exception:
        pass

    return model, class_names, None


def get_model_and_classes(crop_name):
    """
    Retrieves the model and class names for a given crop.
    Validates if the crop is supported and loads the model into cache if not already loaded.
    
    Returns:
        tuple: (model, class_names)
        or
        tuple: (None, error_message)
    """
    # 1. Validate if crop is supported
    if crop_name not in CROP_CONFIGS:
        return None, None, f"Unsupported crop type: {crop_name}"

    # 2. Check if already loaded in cache
    if crop_name in MODELS_CACHE and crop_name in CLASSES_CACHE:
        return MODELS_CACHE[crop_name], CLASSES_CACHE[crop_name], None

    # 3. Load from disk
    config = CROP_CONFIGS[crop_name]
    
    model_dir = _get_model_dir()
    
    model_path = os.path.join(model_dir, config["model_file"]) if "model_file" in config else None
    classes_path = os.path.join(model_dir, config["classes_file"]) if "classes_file" in config else None

    if "model_files" in config:
        model_paths = [os.path.join(model_dir, file_name) for file_name in config["model_files"]]
        classes_paths = [os.path.join(model_dir, file_name) for file_name in config["classes_files"]]

        missing = [path for path in model_paths if not os.path.exists(path)]
        if missing:
            return None, None, f"Model resources not found for {crop_name} at '{missing[0]}'."

        try:
            print(f"Loading TensorFlow Keras models for {crop_name} into API memory...")
            bundles = []
            for idx, model_path_item in enumerate(model_paths):
                model = tf.keras.models.load_model(model_path_item, compile=False)

                expected_classes = None
                try:
                    output_shape = model.output_shape
                    if isinstance(output_shape, list):
                        output_shape = output_shape[0]
                    expected_classes = int(output_shape[-1])
                except Exception:
                    try:
                        expected_classes = int(getattr(model.layers[-1], "units"))
                    except Exception:
                        expected_classes = None

                class_names = _load_class_names(classes_paths[idx], expected_classes)
                if class_names is None:
                    return None, None, f"Unable to resolve class names for {crop_name} from '{classes_paths[idx]}'."

                bundles.append({
                    "name": f"{crop_name}_{idx + 1}",
                    "model": model,
                    "class_names": class_names,
                    "model_path": model_path_item,
                    "classes_path": classes_paths[idx],
                    "input_mode": config.get("input_mode", "auto"),
                    "input_size": config.get("input_size", (224, 224)),
                })

            MODELS_CACHE[crop_name] = bundles
            CLASSES_CACHE[crop_name] = None
            print(f"{crop_name} models loaded successfully.")
            return bundles, None, None

        except Exception as e:
            return None, None, f"Failed to load models for {crop_name}: {str(e)}"

    if not os.path.exists(model_path):
        return None, None, f"Model resources not found for {crop_name} at '{model_path}'."

    try:
        print(f"Loading TensorFlow Keras model for {crop_name} into API memory...")
        model, class_names, error = _load_single_model(
            model_path,
            classes_path,
            crop_name,
            config.get("input_mode", "auto"),
        )
        if error:
            return None, None, error

        MODELS_CACHE[crop_name] = model
        CLASSES_CACHE[crop_name] = class_names

        print(f"{crop_name} model loaded successfully.")
        return model, class_names, None

    except Exception as e:
        return None, None, f"Failed to load model for {crop_name}: {str(e)}"
# Trigger reload
