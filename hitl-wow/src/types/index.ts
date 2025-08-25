export interface ImageData {
  uploaded_img: string;
  processed_img: string;
  detections: Detection[];
  defect_count: number;
}

export interface Detection {
  defect_id: number;
  defect_type: string;
  confidence: number; 
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  status: 'unvalidated' | 'validated' | string; 
  crop_path: string;

  // frontend-only
  validated?: boolean;
  validatedAs?: string;
}

export const DEFECT_CLASSES = [
  'BrownSpot',
  'Browning',
  'BurnedTip',
  'Curling',
  'Purpling',
  'Wilting',
  'Yellowing'
];

export interface ValidationResult {
  detectionId: number;
  decision: 'correct' | 'healthy' | 'other';
  className?: string;
}