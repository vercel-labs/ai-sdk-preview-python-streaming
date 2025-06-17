from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import os
from ..core.database import Base
from ..core.config import settings

# SQLAlchemy Models
class Photo(Base):
    __tablename__ = "photos"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, nullable=False)
    reference_object = Column(String, nullable=True)
    measurement_type = Column(String, nullable=True)
    status = Column(String, nullable=False)  # pending, processing, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    error_message = Column(String, nullable=True)
    
    measurements = relationship("Measurement", back_populates="photo")

    @property
    def file_url(self):
        if self.file_path:
            return f"http://localhost:8000/static/{os.path.basename(self.file_path)}"
        return None

class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("photos.id"))
    length = Column(Float)
    width = Column(Float)
    area = Column(Float)
    confidence = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    photo = relationship("Photo", back_populates="measurements")

# Pydantic Models
class PhotoBase(BaseModel):
    reference_object: Optional[str] = Field(None, description="Type of reference object")
    measurement_type: Optional[str] = Field(None, description="Type of measurement needed")

class PhotoCreate(PhotoBase):
    pass

class PhotoResponse(PhotoBase):
    id: int
    file_path: str
    file_url: str
    status: str
    created_at: datetime
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

class MeasurementBase(BaseModel):
    length: Optional[float] = None
    width: Optional[float] = None
    area: Optional[float] = None
    confidence: Optional[float] = None

class MeasurementCreate(MeasurementBase):
    photo_id: int

class MeasurementResponse(MeasurementBase):
    id: int
    photo_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PhotoWithMeasurements(PhotoResponse):
    measurements: List[MeasurementResponse]

    class Config:
        from_attributes = True 