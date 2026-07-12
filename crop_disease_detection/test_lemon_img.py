import os
import tensorflow as tf
from PIL import Image
import numpy as np
import json

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

model = tf.keras.models.load_model(r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\models\lemon_disease_model.keras", compile=False)
img_path = r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\Backend\uploads\activities\image-1783762402167-329083847.jpeg"

with open(r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\models\lemon_class_names.json", 'r') as f:
    classes = json.load(f)

img = Image.open(img_path).convert("RGB")
img_resized = img.resize((224, 224))
img_array = np.array(img_resized, dtype=np.float32)
img_batch = np.expand_dims(img_array, axis=0)

def print_preds(name, pred):
    print(f"\n{name} Top 3:")
    top_indices = np.argsort(pred)[::-1][:3]
    for i in top_indices:
        print(f"  {classes[i]} (Index {i}): {pred[i]*100:.2f}%")

print_preds("RGB Unit", model.predict(img_batch / 255.0, verbose=0)[0])
print_preds("RGB Minus1to1", model.predict((img_batch / 127.5) - 1.0, verbose=0)[0])
print_preds("RGB Raw", model.predict(img_batch, verbose=0)[0])

img_bgr = img_array[..., ::-1]
img_batch_bgr = np.expand_dims(img_bgr, axis=0)
print_preds("BGR Unit", model.predict(img_batch_bgr / 255.0, verbose=0)[0])
print_preds("BGR Minus1to1", model.predict((img_batch_bgr / 127.5) - 1.0, verbose=0)[0])
print_preds("BGR Raw", model.predict(img_batch_bgr, verbose=0)[0])
