import os
import tensorflow as tf
from PIL import Image
import numpy as np

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

model = tf.keras.models.load_model(r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\models\tomato_disease_model.keras", compile=False)
img_path = r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\Backend\uploads\activities\image-1783753599264-63713653.jpg"

classes = ["Bacterial_spot", "Early_blight", "Late_blight", "Leaf_Mold", "Septoria_leaf_spot", "Spider_mites Two-spotted_spider_mite", "Target_Spot", "Tomato_Yellow_Leaf_Curl_Virus", "Tomato_mosaic_virus", "healthy", "powdery_mildew"]

img = Image.open(img_path).convert("RGB")
img_resized = img.resize((128, 128))
img_array = np.array(img_resized, dtype=np.float32)
img_batch = np.expand_dims(img_array, axis=0)

print("RGB Tests:")
pred1 = model.predict(img_batch / 255.0, verbose=0)[0]
print(f"  Unit ([0, 1]): {classes[np.argmax(pred1)]} ({np.max(pred1)*100:.2f}%)")

pred2 = model.predict((img_batch / 127.5) - 1.0, verbose=0)[0]
print(f"  Minus1to1 ([-1, 1]): {classes[np.argmax(pred2)]} ({np.max(pred2)*100:.2f}%)")

# Now BGR
img_bgr = img_array[..., ::-1]
img_batch_bgr = np.expand_dims(img_bgr, axis=0)

print("\nBGR Tests:")
pred3 = model.predict(img_batch_bgr / 255.0, verbose=0)[0]
print(f"  Unit ([0, 1]): {classes[np.argmax(pred3)]} ({np.max(pred3)*100:.2f}%)")

pred4 = model.predict((img_batch_bgr / 127.5) - 1.0, verbose=0)[0]
print(f"  Minus1to1 ([-1, 1]): {classes[np.argmax(pred4)]} ({np.max(pred4)*100:.2f}%)")

# Also test raw [0, 255]
print("\nRaw Tests (0, 255):")
pred5 = model.predict(img_batch, verbose=0)[0]
print(f"  RGB Raw: {classes[np.argmax(pred5)]} ({np.max(pred5)*100:.2f}%)")
pred6 = model.predict(img_batch_bgr, verbose=0)[0]
print(f"  BGR Raw: {classes[np.argmax(pred6)]} ({np.max(pred6)*100:.2f}%)")
