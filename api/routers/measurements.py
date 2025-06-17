from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import cv2
import numpy as np
from ..core.database import get_db
from ..models.schemas import (
    Photo,
    Measurement,
    MeasurementCreate,
    MeasurementResponse
)
from ..services.image_processor import ImageProcessor
from ..services.measurement_calculator import MeasurementCalculator
from ..utils.websocket_manager import connection_manager

router = APIRouter()
image_processor = ImageProcessor()
measurement_calculator = MeasurementCalculator()

def process_photo(photo_id: int, db: Session):
    """Background task to process photo and calculate measurements"""
    
    # Get photo record
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        return
    
    try:
        # Update status to processing
        photo.status = "processing"
        db.commit()
        
        # Read image
        with open(photo.file_path, "rb") as f:
            image_bytes = f.read()
        
        # Process image
        image = image_processor.preprocess_image(image_bytes)
        
        # Detect or auto-detect reference object
        if not photo.reference_object:
            detected_type, ref_detection = image_processor.detect_best_reference_object(image)
            if detected_type is None or ref_detection is None:
                raise Exception("Reference object could not be detected in the image.")
            # Persist detected reference type
            photo.reference_object = detected_type
            db.commit()
        else:
            ref_detection = image_processor.detect_reference_object(
                image,
                photo.reference_object
            )
            if ref_detection is None:
                raise Exception("Reference object could not be detected in the image.")
        
        # Calculate pixel scale from the warped image
        pixel_scale = image_processor.calculate_pixel_scale(
            ref_detection,
            photo.reference_object
        )

        if pixel_scale == 0.0:
            raise Exception("Could not calculate pixel scale. Check reference object dimensions.")
        
        # Extract object contours from the warped image
        contour = measurement_calculator.extract_object_contours(ref_detection['warped'])
        
        if contour is None:
            raise Exception("Failed to extract object contours from the warped image.")
        
        # Calculate dimensions
        dimensions = measurement_calculator.calculate_dimensions(contour, pixel_scale)
        
        # Create measurement record
        measurement = Measurement(
            photo_id=photo.id,
            length=dimensions["length"],
            width=dimensions["width"],
            area=dimensions["area"],
            confidence=dimensions["confidence"]
        )
        
        db.add(measurement)
        photo.status = "completed"
        db.commit()
        
    except Exception as e:
        photo.status = "failed"
        photo.error_message = str(e)
        db.commit()
        # We don't re-raise the exception to prevent the background task from crashing silently
        # The error is logged to the DB for the user to see.
        print(f"Error processing photo {photo_id}: {e}")

@router.post("/photos/{photo_id}/process")
async def start_processing(
    photo_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start processing a photo to extract measurements"""
    
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if photo.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Photo is already in {photo.status} state"
        )
    
    background_tasks.add_task(process_photo, photo_id, db)
    
    return {"status": "Processing started"}

@router.get("/photos/{photo_id}/measurements", response_model=List[MeasurementResponse])
def get_measurements(
    photo_id: int,
    db: Session = Depends(get_db)
):
    """Get measurements for a specific photo"""
    
    measurements = db.query(Measurement).filter(
        Measurement.photo_id == photo_id
    ).all()
    
    if not measurements:
        raise HTTPException(status_code=404, detail="No measurements found")
    
    return measurements 