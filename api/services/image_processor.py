import cv2
import numpy as np
from typing import Dict, Tuple, Optional
from ..core.config import settings
from imutils.perspective import four_point_transform

class ImageProcessor:
    def __init__(self):
        """Initialize OpenCV components and preprocessing parameters"""
        self.reference_objects = settings.REFERENCE_OBJECTS
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """Preprocess uploaded image for analysis"""
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Basic preprocessing
        image = cv2.GaussianBlur(image, (5, 5), 0)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        return image
    
    def _four_point_transform(self, image: np.ndarray, pts: np.ndarray) -> np.ndarray:
        """Applies a four point transform to obtain a top-down view of the object"""
        return four_point_transform(image, pts)

    def detect_reference_object(self, image: np.ndarray, ref_type: str) -> Optional[Dict]:
        """Detect and locate reference object in image"""
        if ref_type not in self.reference_objects:
            return None
            
        # For this implementation, we'll use a robust edge detection method for all reference objects.
        detection_result = self._detect_by_edges(image)

        if detection_result is None:
            return None

        # Get the warped (top-down) view of the reference object
        warped_image = self._four_point_transform(image, detection_result["box"])
        
        return {
            "bbox": detection_result["bbox"],
            "box_points": detection_result["box"],
            "warped": warped_image
        }
    
    def _detect_by_edges(self, image: np.ndarray) -> Optional[Dict]:
        """Detects a rectangular object by analyzing edges."""
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        edged = cv2.Canny(blurred, 50, 100)
        
        # Find contours in the edge map
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None

        # Sort contours by area and process the largest ones
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        
        for c in contours:
            # Approximate the contour
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            
            # If the approximated contour has four points, we assume it is our object
            if len(approx) == 4:
                # Get bounding box and corner points
                x, y, w, h = cv2.boundingRect(approx)
                
                # Filter out contours that are too small or too large
                if w < 50 or h < 50:
                    continue

                return {
                    "bbox": [x, y, w, h],
                    "box": approx.reshape(4, 2)
                }
        
        return None
    
    def calculate_pixel_scale(self, ref_detection: Dict, ref_type: str) -> float:
        """Calculate pixels-per-unit scale from the warped reference object"""
        if not ref_detection or "warped" not in ref_detection:
            return 0.0
        
        warped_image = ref_detection["warped"]
        ref_dims = self.reference_objects[ref_type]
        
        # The width of the warped image corresponds to the real-world width
        pixel_width = warped_image.shape[1]
        
        # Calculate scale (pixels per cm)
        if "width" in ref_dims:
            return pixel_width / ref_dims["width"]
        elif "length" in ref_dims:
            # Assuming the longer side is the length
            return pixel_width / ref_dims["length"]
            
        return 0.0

    def detect_best_reference_object(self, image: np.ndarray) -> Tuple[Optional[str], Optional[Dict]]:
        """Automatically detect the best matching reference object in the given image.

        Iterates over all configured reference objects and returns the first
        successful detection along with its type. Currently, the first detected
        object is returned without additional confidence ranking.
        """
        for ref_type in self.reference_objects.keys():
            detection = self.detect_reference_object(image, ref_type)
            if detection is not None:
                return ref_type, detection
        return None, None 