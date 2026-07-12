import os
import json
import warnings
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from PIL import Image

import tensorflow as tf
from tensorflow.keras.preprocessing import image_dataset_from_directory
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import (
    Input, GlobalAveragePooling2D, Dense, Dropout, 
    RandomFlip, RandomRotation, RandomZoom
)
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)
from sklearn.metrics import classification_report, confusion_matrix

# Suppress warnings
warnings.filterwarnings('ignore')
tf.get_logger().setLevel('ERROR')

# ==========================================
# 1. CONFIGURATION (Change these per crop)
# ==========================================
CROP_NAME = "Beans"  # e.g., "Tomato", "Beans", "Brinjal", "Papaya"
DATASET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dataset", "beans")
MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
PLOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plots")

# Based on existing API configurations:
# Beans -> bean_disease_model.keras, beans_class_names.json
# Tomato -> tomato_disease_model .keras, class_names.json
if CROP_NAME == "Beans":
    MODEL_NAME = "bean_disease_model.keras"
    CLASS_NAMES_FILE = "beans_class_names.json"
elif CROP_NAME == "Tomato":
    # Keeping the space for compatibility with current backend configuration
    MODEL_NAME = "tomato_disease_model .keras"
    CLASS_NAMES_FILE = "class_names.json"
else:
    MODEL_NAME = f"{CROP_NAME.lower()}_disease_model.keras"
    CLASS_NAMES_FILE = f"{CROP_NAME.lower()}_class_names.json"

IMG_SIZE = (224, 224) # MobileNetV2 default
BATCH_SIZE = 32
EPOCHS = 20
TEST_SPLIT = 0.1  # 10% for testing
VALIDATION_SPLIT = 0.2 # 20% for validation (from the remaining 90%)

# ==========================================
# 2. HELPER FUNCTIONS
# ==========================================
def remove_corrupted_images(dataset_path):
    """Scan and remove corrupted or unsupported images."""
    print("Scanning for corrupted images...")
    num_skipped = 0
    for folder_name in os.listdir(dataset_path):
        folder_path = os.path.join(dataset_path, folder_name)
        if not os.path.isdir(folder_path):
            continue
        for fname in os.listdir(folder_path):
            fpath = os.path.join(folder_path, fname)
            try:
                img = Image.open(fpath)
                img.verify()
            except Exception:
                print(f"Removing corrupted/unsupported file: {fpath}")
                os.remove(fpath)
                num_skipped += 1
    print(f"Removed {num_skipped} corrupted images.\n")

def ensure_directories():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR, exist_ok=True)

# ==========================================
# 3. MAIN PIPELINE
# ==========================================
def main():
    ensure_directories()
    
    if not os.path.exists(DATASET_PATH):
        print(f"Error: Dataset path not found: {DATASET_PATH}")
        print("Please ensure your dataset is organized as DATASET_PATH/class_name/image.jpg")
        return

    # Clean dataset
    remove_corrupted_images(DATASET_PATH)

    # 3.1 Load Dataset with Validation Split
    print("Loading datasets...")
    train_ds = image_dataset_from_directory(
        DATASET_PATH,
        validation_split=VALIDATION_SPLIT + TEST_SPLIT,
        subset="training",
        seed=1337,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical'
    )
    
    val_test_ds = image_dataset_from_directory(
        DATASET_PATH,
        validation_split=VALIDATION_SPLIT + TEST_SPLIT,
        subset="validation",
        seed=1337,
        image_size=IMG_SIZE,
        batch_size=BATCH_SIZE,
        label_mode='categorical'
    )
    
    # Split val_test_ds into validation (2/3) and test (1/3)
    val_batches = tf.data.experimental.cardinality(val_test_ds)
    test_ds = val_test_ds.take(val_batches // 3)
    val_ds = val_test_ds.skip(val_batches // 3)

    class_names = train_ds.class_names
    num_classes = len(class_names)
    print(f"Found {num_classes} classes: {class_names}\n")

    # Save class names for API
    classes_path = os.path.join(MODELS_DIR, CLASS_NAMES_FILE)
    with open(classes_path, 'w') as f:
        json.dump(class_names, f)
    print(f"Saved class names to {classes_path}")

    # Prefetch for performance
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000).prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)
    test_ds = test_ds.cache().prefetch(buffer_size=AUTOTUNE)

    # 3.2 Data Augmentation
    data_augmentation = Sequential([
        RandomFlip("horizontal_and_vertical"),
        RandomRotation(0.2),
        RandomZoom(0.2)
    ], name="data_augmentation")

    # 3.3 Build MobileNetV2 Model
    print("Building MobileNetV2 model...")
    base_model = MobileNetV2(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False  # Freeze base model

    # Create the top model
    inputs = Input(shape=IMG_SIZE + (3,))
    x = data_augmentation(inputs)
    
    # MobileNetV2 preprocess layer scales [0, 255] to [-1, 1] natively inside the model graph!
    # The API view has a check `if not has_rescaling` which will see 'preprocess' and safely skip manual scaling.
    x = tf.keras.layers.Lambda(preprocess_input, name='mobilenet_preprocess')(x)
    
    x = base_model(x, training=False)
    x = GlobalAveragePooling2D()(x)
    x = Dropout(0.5)(x)
    outputs = Dense(num_classes, activation='softmax', name='predictions')(x)

    model = Model(inputs, outputs)

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    model.summary()

    # 3.4 Callbacks
    model_save_path = os.path.join(MODELS_DIR, MODEL_NAME)
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True, verbose=1),
        ModelCheckpoint(filepath=model_save_path, monitor='val_accuracy', save_best_only=True, verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=3, min_lr=1e-6, verbose=1)
    ]

    # 3.5 Training Phase 1: Train Top Layer
    print("\n--- Training Phase 1 (Top Layer) ---")
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS,
        callbacks=callbacks
    )

    # 3.6 Fine-tuning Phase (Optional but recommended)
    print("\n--- Training Phase 2 (Fine-tuning) ---")
    base_model.trainable = True
    
    # Freeze bottom layers of MobileNetV2, train only top layers for fine-tuning
    fine_tune_at = 100
    for layer in base_model.layers[:fine_tune_at]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5), # Lower LR for fine-tuning
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    history_fine = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=EPOCHS // 2,
        callbacks=callbacks
    )

    # 3.7 Evaluation on Test Set
    print("\n--- Evaluating on Test Set ---")
    test_loss, test_acc = model.evaluate(test_ds)
    print(f"Test Accuracy: {test_acc:.4f}")
    
    # Ensure final model is saved
    model.save(model_save_path)
    print(f"Model saved successfully to {model_save_path}")

    # 3.8 Generate Confusion Matrix & Classification Report
    print("\nGenerating evaluation metrics...")
    y_true = []
    y_pred = []
    
    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(np.argmax(labels.numpy(), axis=1))
        y_pred.extend(np.argmax(preds, axis=1))
        
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    print("\nClassification Report:")
    print(classification_report(y_true, y_pred, target_names=class_names))

    # Confusion Matrix Plot
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=class_names, yticklabels=class_names)
    plt.title(f'Confusion Matrix - {CROP_NAME}')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, f'{CROP_NAME.lower()}_confusion_matrix.png'))
    print(f"Confusion matrix saved to {PLOTS_DIR}")

    # 3.9 Prediction Testing on a single random image from test set
    print("\n--- Prediction Testing ---")
    for images, labels in test_ds.take(1):
        sample_img = images[0]
        true_label = class_names[np.argmax(labels[0])]
        
        pred = model.predict(tf.expand_dims(sample_img, 0), verbose=0)
        pred_label = class_names[np.argmax(pred[0])]
        confidence = np.max(pred[0]) * 100
        
        print(f"Test Image True Label: {true_label}")
        print(f"Model Prediction: {pred_label} ({confidence:.2f}%)")
        break

if __name__ == "__main__":
    main()
