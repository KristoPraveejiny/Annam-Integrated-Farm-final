import re

files_to_update = [
    r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\django_api\api\model_loader.py",
    r"d:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\predict.py"
]

for f in files_to_update:
    with open(f, 'r') as file:
        text = file.read()
    
    text = re.sub(r'"input_mode":\s*"(raw|unit)"', '"input_mode": "minus1to1"', text)
    
    with open(f, 'w') as file:
        file.write(text)
    
    print(f"Updated {f}")
