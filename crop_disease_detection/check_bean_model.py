import json
import os

import tensorflow as tf


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "models", "bean_disease_model.keras")
    classes_path = os.path.join(base_dir, "models", "beans_class_names.json")

    print(f"Loading model: {model_path}")
    model = tf.keras.models.load_model(model_path, compile=False)
    model.summary()

    print("\n--- Layer Details ---")
    for layer in model.layers:
        print(f"Name: {layer.name}, Class: {layer.__class__.__name__}")

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

    if os.path.exists(classes_path):
        with open(classes_path, "r") as f:
            class_names = json.load(f)
        print(f"\nClass names file: {classes_path}")
        print(f"Class names count: {len(class_names)}")
        print(f"Class names: {class_names}")

        if expected_classes is not None and len(class_names) != expected_classes:
            print(
                f"\nWARNING: The bean model outputs {expected_classes} classes, but the class-name file contains "
                f"{len(class_names)} labels. Update beans_class_names.json before running inference."
            )
    else:
        print(f"\nClass names file not found: {classes_path}")


if __name__ == "__main__":
    main()
