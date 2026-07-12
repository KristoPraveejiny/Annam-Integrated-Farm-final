import os
import json
import matplotlib.pyplot as plt
import tensorflow as tf
# pyrefly: ignore [missing-import]
from tensorflow.keras.preprocessing import image_dataset_from_directory
# pyrefly: ignore [missing-import]
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import GlobalAveragePooling2D, Dense, Dropout, RandomFlip, RandomRotation, RandomZoom
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRAIN_DIR = os.path.join(BASE_DIR, 'dataset', 'train')
VALID_DIR = os.path.join(BASE_DIR, 'dataset', 'valid')
MODELS_DIR = os.path.join(BASE_DIR, 'models')
PLOTS_DIR = os.path.join(BASE_DIR, 'plots')

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
EPOCHS = 20

def create_directories():
    """Create necessary directories for models and plots."""
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PLOTS_DIR, exist_ok=True)

def main():
    create_directories()
    
    print("Loading dataset...")
    # 1. Load Dataset
    if not os.path.exists(TRAIN_DIR) or not os.path.exists(VALID_DIR):
        print(f"Error: Dataset directories not found.")
        print(f"Please ensure {TRAIN_DIR} and {VALID_DIR} exist.")
        return

    train_dataset = image_dataset_from_directory(
        TRAIN_DIR,
        shuffle=True,
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        label_mode='categorical'
    )

    valid_dataset = image_dataset_from_directory(
        VALID_DIR,
        shuffle=True,
        batch_size=BATCH_SIZE,
        image_size=IMG_SIZE,
        label_mode='categorical'
    )

    class_names = train_dataset.class_names
    num_classes = len(class_names)
    print(f"Found {num_classes} classes: {class_names}")

    # 12. Save class names to json
    class_names_path = os.path.join(MODELS_DIR, 'class_names.json')
    with open(class_names_path, 'w') as f:
        json.dump(class_names, f)
    print(f"Class names saved to {class_names_path}")

    # Prefetching for performance optimization
    AUTOTUNE = tf.data.AUTOTUNE
    train_dataset = train_dataset.prefetch(buffer_size=AUTOTUNE)
    valid_dataset = valid_dataset.prefetch(buffer_size=AUTOTUNE)

    # 4. Data Augmentation
    data_augmentation = Sequential([
        RandomFlip("horizontal_and_vertical"),
        RandomRotation(0.2),
        RandomZoom(0.2),
    ], name="data_augmentation")

    # 5. Load MobileNetV2 pre-trained on ImageNet
    base_model = MobileNetV2(
        input_shape=IMG_SIZE + (3,),
        include_top=False,
        weights='imagenet'
    )

    # 6. Freeze base model initially
    base_model.trainable = False

    # 7. Add classification head
    inputs = tf.keras.Input(shape=IMG_SIZE + (3,))
    # Apply data augmentation
    x = data_augmentation(inputs)
    # Preprocess inputs as required by MobileNetV2 (scales pixels to [-1, 1])
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    # Pass to base model
    x = base_model(x, training=False)
    # Classification head
    x = GlobalAveragePooling2D()(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.3)(x)
    outputs = Dense(num_classes, activation='softmax')(x)

    model = tf.keras.Model(inputs, outputs)

    # 8. Compile the model
    model.compile(
        optimizer=tf.keras.optimizers.Adam(),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )

    model.summary()

    # 9. Callbacks
    model_save_path = os.path.join(MODELS_DIR, 'crop_disease_model.keras')
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True),
        ModelCheckpoint(filepath=model_save_path, monitor='val_accuracy', save_best_only=True),
        ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=3, min_lr=1e-6)
    ]

    # 10. Train model
    print("\nStarting training...")
    history = model.fit(
        train_dataset,
        validation_data=valid_dataset,
        epochs=EPOCHS,
        callbacks=callbacks
    )

    # 13. Generate training graphs
    acc = history.history['accuracy']
    val_acc = history.history['val_accuracy']
    loss = history.history['loss']
    val_loss = history.history['val_loss']

    epochs_range = range(len(acc))

    plt.figure(figsize=(12, 6))
    
    # Accuracy Plot
    plt.subplot(1, 2, 1)
    plt.plot(epochs_range, acc, label='Training Accuracy')
    plt.plot(epochs_range, val_acc, label='Validation Accuracy')
    plt.legend(loc='lower right')
    plt.title('Training and Validation Accuracy')

    # Loss Plot
    plt.subplot(1, 2, 2)
    plt.plot(epochs_range, loss, label='Training Loss')
    plt.plot(epochs_range, val_loss, label='Validation Loss')
    plt.legend(loc='upper right')
    plt.title('Training and Validation Loss')

    plot_path = os.path.join(PLOTS_DIR, 'training_history.png')
    plt.savefig(plot_path)
    print(f"Training plots saved to {plot_path}")

    # 14. Print final metrics
    final_train_acc = acc[-1]
    final_val_acc = val_acc[-1]
    
    print("\n--- Training Complete ---")
    print(f"Final Training Accuracy: {final_train_acc:.4f}")
    print(f"Final Validation Accuracy: {final_val_acc:.4f}")
    
    # 11. Ensure model is saved at the end (although ModelCheckpoint already saves the best)
    model.save(model_save_path)
    print(f"Model saved to {model_save_path}")

if __name__ == "__main__":
    main()
