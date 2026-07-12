import re
files = [r'd:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\predict.py', r'd:\Praveena\3rd year\2nd semi\Annam Integrated Farm\crop_disease_detection\django_api\api\model_loader.py']
for file in files:
    with open(file, 'r') as f:
        content = f.read()
    for crop in ['Paddy', 'Lemon', 'Turmeric']:
        pattern = r'("' + crop + r'":\s*\{[^\}]+?"input_mode":\s*")raw(")'
        content = re.sub(pattern, r'\g<1>minus1to1\g<2>', content)
    with open(file, 'w') as f:
        f.write(content)
print('Reverted files!')
