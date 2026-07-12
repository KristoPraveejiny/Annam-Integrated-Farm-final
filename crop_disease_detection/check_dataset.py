from PIL import Image
import os

dataset_path = "dataset"
deleted_count = 0
bad_files = []

print("Checking dataset for corrupted images...\n")

for root, dirs, files in os.walk(dataset_path):
    for file in files:
        path = os.path.join(root, file)

        try:
            with Image.open(path) as img:
                img.verify()   # Verify image integrity

        except Exception as e:
            bad_files.append(path)

            try:
                os.remove(path)   # Auto delete corrupted file
                deleted_count += 1
                print(f"Deleted: {path}")
            except Exception as delete_error:
                print(f"Could not delete: {path}")
                print(delete_error)

print("\n------ Summary ------")
print(f"Total corrupted files found: {len(bad_files)}")
print(f"Total deleted files: {deleted_count}")

if deleted_count == 0:
    print("No bad files found. Dataset is clean ✅")
else:
    print("Corrupted files removed successfully ✅")