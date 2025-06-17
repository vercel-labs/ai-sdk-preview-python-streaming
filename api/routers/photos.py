import os
from typing import List
from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from ..core.config import settings
from ..core.database import get_db
from ..models.schemas import Photo, PhotoCreate, PhotoResponse, PhotoWithMeasurements
from ..services.image_processor import ImageProcessor
from ..services.measurement_calculator import MeasurementCalculator
from ..routers.measurements import process_photo

router = APIRouter()
image_processor = ImageProcessor()
measurement_calculator = MeasurementCalculator()

@router.post("/photos", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = File(...),
    reference_object: str | None = Form(None),
    measurement_type: str | None = Form(None),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db)
):
    """Upload and process a photo for measurement"""
    
    # Validate file format
    if not file.filename.lower().endswith(tuple(settings.SUPPORTED_FORMATS)):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported formats: {settings.SUPPORTED_FORMATS}"
        )
    
    # Create upload directory if it doesn't exist
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save file
    file_path = os.path.join(settings.UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Create photo record (temporary placeholder values if not provided)
    photo = Photo(
        file_path=file_path,
        reference_object=reference_object or "",
        measurement_type=measurement_type or "",
        status="pending"
    )
    
    db.add(photo)
    db.commit()
    db.refresh(photo)
    
    # Rename file to use the photo ID for easier retrieval
    _, ext = os.path.splitext(file.filename)
    new_filename = f"{photo.id}{ext}"
    new_path = os.path.join(settings.UPLOAD_DIR, new_filename)

    # In case of duplicate names, overwrite
    os.replace(file_path, new_path)

    photo.file_path = new_path
    db.commit()

    # Start processing the photo automatically
    background_tasks.add_task(process_photo, photo.id, db)

    # Create a proper response with the file URL
    response = PhotoResponse(
        id=photo.id,
        file_path=photo.file_path,
        file_url=photo.file_url,
        reference_object=photo.reference_object,
        measurement_type=photo.measurement_type,
        status=photo.status,
        created_at=photo.created_at,
        error_message=photo.error_message
    )
    return response

@router.get("/photos", response_model=List[PhotoResponse])
def list_photos(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """List all uploaded photos"""
    photos = db.query(Photo).offset(skip).limit(limit).all()
    return photos

@router.get("/photos/{photo_id}", response_model=PhotoWithMeasurements)
def get_photo(
    photo_id: int,
    db: Session = Depends(get_db)
):
    """Get a specific photo with its measurements"""
    photo = db.query(Photo).filter(Photo.id == photo_id).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo 