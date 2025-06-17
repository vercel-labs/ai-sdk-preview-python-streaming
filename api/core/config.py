from pydantic_settings import BaseSettings
from typing import List, Dict, Any, ClassVar
import os


class Settings(BaseSettings):
    """Application configuration"""
    
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Photo Measurement API"
    
    # File Upload Settings
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    SUPPORTED_FORMATS: List[str] = ["jpg", "jpeg", "png", "bmp"]
    UPLOAD_DIR: str = "uploads"
    IMAGE_STORE_DIR: str = UPLOAD_DIR
    
    # Model Settings
    MODEL_PATH: str = "models/measurement_detector.tflite"
    CONFIDENCE_THRESHOLD: float = 0.7
    
    # Database Settings
    SQLITE_URL: str = "sqlite:///./measurement.db"
    
    # Reference Objects
    REFERENCE_OBJECTS: ClassVar[Dict[str, Any]] = {
        "credit_card": {
            "length": 8.56,  # cm
            "width": 5.398,  # cm
            "detection_method": "template_matching",
            "confidence_threshold": 0.8
        },
        "ruler": {
            "length": 30.0,  # cm
            "detection_method": "edge_detection",
            "confidence_threshold": 0.7
        }
    }

    class Config:
        case_sensitive = True


settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True) 