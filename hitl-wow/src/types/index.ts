export interface Detection {
  id: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  classId: number;
  className: string;
  imagePath: string;
  validated?: boolean;
  validatedAs?: string;
  cropPath: string;
}

export interface ValidationResult {
  detectionId: string;
  decision: 'correct' | 'healthy' | 'other';
  className?: string;
}

export interface ImageData {
  path: string;
  name: string;
  detections: Detection[];
  processed: boolean;
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
