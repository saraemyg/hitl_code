import os
import cv2
import tkinter as tk
from tkinter import ttk
from ultralytics import YOLO
from PIL import Image, ImageTk
import numpy as np

# ----------------------------
# CONFIG
# ----------------------------
MODEL_PATH = "best0331.pt"
TEST_IMAGES_DIR = "test_images"
OUTPUT_DATA_DIR = "defect_data/train"
CONF_LOW, CONF_HIGH = 0.1, 0.5
CLASSES = ['BrownSpot', 'Browning', 'BurnedTip', 'Curling', 'Purpling', 'Wilting', 'Yellowing']

# Ensure output dirs exist
os.makedirs(os.path.join(OUTPUT_DATA_DIR, "images"), exist_ok=True)
os.makedirs(os.path.join(OUTPUT_DATA_DIR, "labels"), exist_ok=True)

# Load YOLO model
model = YOLO(MODEL_PATH)

# ----------------------------
# Global GUI State
# ----------------------------
current_img = None
current_bbox = None
current_label = None   # detected label + confidence
current_cls_id = None

root = None
panel = None
dropdown = None
save_labels = []       # list of YOLO formatted labels for current image
save_img_path = None
label_file_path = None
orig_h, orig_w = 0, 0


def save_decision(label_text):
    """Save validated bbox into label list for current image"""
    global current_img, current_bbox, save_labels, root, orig_h, orig_w, current_cls_id

    if current_img is None or current_bbox is None:
        return

    # If user marks as healthy, skip writing a label entirely.
    if label_text == "healthy":
        root.destroy()   # keep your existing behavior
        return

    # Determine class_id
    if label_text == "correct defect":
        # Use the original predicted class id
        class_id = current_cls_id if current_cls_id is not None else 0
    else:
        # "Other defect" selected from dropdown -> map name to id
        try:
            class_id = CLASSES.index(label_text)
        except ValueError:
            # Fallback: if not found, skip to avoid corrupt labels
            root.destroy()
            return

    # Compute normalized YOLO bbox (relative to the ORIGINAL image)
    x1, y1, x2, y2 = current_bbox
    xc = ((x1 + x2) / 2) / orig_w
    yc = ((y1 + y2) / 2) / orig_h
    bw = (x2 - x1) / orig_w
    bh = (y2 - y1) / orig_h

    save_labels.append(f"{class_id} {xc:.6f} {yc:.6f} {bw:.6f} {bh:.6f}\n")

    # Keep your current flow (close window after each decision)
    root.destroy()


def decision_correct():
    save_decision("correct defect")


def decision_healthy():
    save_decision("healthy")


def decision_other():
    global dropdown
    save_decision(dropdown.get())


def show_image(orig_img, crop_img, bbox, label_info, progress_text, conf, cls_id):
    """Show overall image (with bbox) + crop in Tkinter with detection label + decision buttons"""
    global root, panel, dropdown, current_img, current_bbox, current_label, current_cls_id, content_frame, dropdown

    current_img = orig_img
    current_bbox = bbox
    current_label = label_info
    current_cls_id = cls_id

    root = tk.Tk()
    root.title("Human-in-the-Loop Validation")
    root.geometry("1320x750")  # enough for 2x640 images side by side

    # Show header (progress + file info)
    tk.Label(root, text=progress_text, font=("Arial", 12, "bold")).pack(pady=5)

    # --- Left: overall image with bbox ---
    overall = orig_img.copy()
    x1, y1, x2, y2 = bbox
    # Draw thicker rectangle (bbox) - thickness = 6 for bolder lines
    cv2.rectangle(overall, (x1, y1), (x2, y2), (0, 255, 0), 10)

    # Put label text ABOVE the bbox with background rectangle
    label_text = f"{label_info} {conf:.2f}"  # Example: "defect 0.45"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1
    font_thickness = 3
    (text_w, text_h), baseline = cv2.getTextSize(label_text, font, font_scale, font_thickness)
    
    # Draw background rectangle for text (above bbox)
    cv2.rectangle(
        overall,
        (x1, y1 - text_h - 10),  # top-left corner
        (x1 + text_w, y1),       # bottom-right corner
        (0, 255, 0),             # same color as bbox
        -1                       # filled
    )
    # Put the text on top of the background
    cv2.putText(
        overall,
        label_text,
        (x1, y1 - 5),
        font,
        font_scale,
        (0, 0, 0),  # black text for contrast
        font_thickness,
        lineType=cv2.LINE_AA
    )
    
    # Resize for display
    overall = cv2.resize(overall, (500, 500))
    overall = cv2.cvtColor(overall, cv2.COLOR_BGR2RGB)
    overall_imgtk = ImageTk.PhotoImage(image=Image.fromarray(overall))

    # --- Right: cropped region only ---
    disp_img = cv2.resize(crop_img, (500, 500))
    disp_img = cv2.cvtColor(disp_img, cv2.COLOR_BGR2RGB)
    disp_imgtk = ImageTk.PhotoImage(image=Image.fromarray(disp_img))

    # Frame for side-by-side display
    img_frame = tk.Frame(root)
    img_frame.pack()

    panel_left = tk.Label(img_frame, image=overall_imgtk)
    panel_left.image = overall_imgtk
    panel_left.pack(side="left", padx=10, pady=10)

    panel_right = tk.Label(img_frame, image=disp_imgtk)
    panel_right.image = disp_imgtk
    panel_right.pack(side="right", padx=10, pady=10)

    # Show detection label
    tk.Label(root, text=f"Detected: {label_info}", font=("Arial", 12)).pack(pady=5)

    # Buttons
    btn_frame = tk.Frame(root)
    btn_frame.pack(pady=10)

    tk.Button(btn_frame, text="Correct Defect", command=decision_correct, width=20).grid(row=0, column=0, padx=5)
    tk.Button(btn_frame, text="Healthy", command=decision_healthy, width=20).grid(row=0, column=1, padx=5)

    tk.Label(root, text="Other Defect:").pack()
    dropdown = ttk.Combobox(root, values=CLASSES, state="readonly")
    dropdown.pack()
    dropdown.set(CLASSES[0])
    tk.Button(root, text="Confirm Other Defect", command=decision_other, width=25).pack(pady=5)

    root.mainloop()


def process_images():
    global save_labels, save_img_path, label_file_path, orig_h, orig_w

    all_files = [f for f in os.listdir(TEST_IMAGES_DIR) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
    total_images = len(all_files)

    for idx, image_name in enumerate(all_files, start=1):
        img_path = os.path.join(TEST_IMAGES_DIR, image_name)

        results = model(img_path, conf=CONF_LOW)  # run detection
        orig_img = cv2.imread(img_path)
        orig_h, orig_w = orig_img.shape[:2]

        # Prepare save paths
        save_img_path = os.path.join(OUTPUT_DATA_DIR, "images", image_name)
        label_file_path = os.path.join(
            OUTPUT_DATA_DIR, "labels", os.path.splitext(image_name)[0] + ".txt"
        )

        save_labels = []  # reset for this image

        detections = []  # store detections first

        for r in results:
            for box in r.boxes:
                conf = float(box.conf[0])
                if CONF_LOW < conf < CONF_HIGH:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cls_id = int(box.cls[0])
                    label_name = CLASSES[cls_id] if cls_id < len(CLASSES) else "Unknown"
                    detections.append([x1, y1, x2, y2, conf, cls_id, label_name])

        # --- Apply custom NMS (IoU > 0.8 suppression) ---
        detections = sorted(detections, key=lambda x: x[4], reverse=True)  # sort by confidence
        final_detections = []

        def iou(box1, box2):
            x1 = max(box1[0], box2[0])
            y1 = max(box1[1], box2[1])
            x2 = min(box1[2], box2[2])
            y2 = min(box1[3], box2[3])

            inter_area = max(0, x2 - x1) * max(0, y2 - y1)
            box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
            box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
            union_area = box1_area + box2_area - inter_area

            return inter_area / union_area if union_area > 0 else 0

        while detections:
            best = detections.pop(0)  # take highest conf
            final_detections.append(best)
            detections = [d for d in detections if iou(best, d) < 0.3]  # suppress overlaps > 80%

        # --- Process final detections ---
        for x1, y1, x2, y2, conf, cls_id, label_name in final_detections:
            label_info = f"{label_name} ({conf:.2f})"

            # Add 50px padding
            x1, y1 = max(0, x1 - 50), max(0, y1 - 50)
            x2, y2 = min(orig_img.shape[1], x2 + 50), min(orig_img.shape[0], y2 + 50)
            crop = orig_img[y1:y2, x1:x2]

            progress_text = f"Image {idx}/{total_images} - {image_name}"
            show_image(orig_img, crop, (x1, y1, x2, y2), label_info, progress_text, conf, cls_id)

        # Save only if at least one validated bbox
        if save_labels:
            cv2.imwrite(save_img_path, orig_img)
            with open(label_file_path, "w") as f:
                f.writelines(save_labels)

if __name__ == "__main__":
    process_images()
