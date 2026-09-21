from ultralytics import YOLO

print("Loading model...")

model = YOLO("best.pt")

print("Exporting to TensorFlow.js...")

model.export(format="tfjs")

print("Export completed")