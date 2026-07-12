import os
import tensorflow as tf
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

models_dir = r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\models"

for filename in os.listdir(models_dir):
    if filename.endswith(".keras"):
        filepath = os.path.join(models_dir, filename)
        try:
            model = tf.keras.models.load_model(filepath, compile=False)
            print(f"{filename}: {model.input_shape}")
        except Exception as e:
            pass
