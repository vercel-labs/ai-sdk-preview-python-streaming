# FastAPI Photo Measurement Extraction Backend - Implementation Scope

## Project Overview
A FastAPI backend service that analyzes user-submitted photos to extract real-world measurements using computer vision and AI models. The system requires reference objects for accurate scaling and supports integration with Shopify storefronts.

## Technology Stack
- **FastAPI** - Web framework
- **OpenCV** - Image processing
- **TensorFlow Lite** - Lightweight ML inference
- **Pillow** - Image manipulation
- **NumPy** - Numerical computations
- **Pydantic** - Data validation
- **SQLAlchemy** - Database ORM (optional for logging): skip for now

## API Endpoints Structure

### 1. Health Check Endpoint
```python
@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy", "service": "measurement-api"}
```

### 2. Photo Upload & Analysis Endpoint
```python
@app.post("/analyze-photo")
async def analyze_photo(
    file: UploadFile = File(...),
    reference_object: str = Form(...),
    measurement_type: str = Form(...)
):
    """
    Main endpoint for photo analysis and measurement extraction
    
    Should implement:
    - File validation (format, size limits)
    - Image preprocessing pipeline
    - Reference object detection
    - Target object measurement
    - Results formatting and return
    """
```

### 3. Supported Reference Objects Endpoint
```python
@app.get("/reference-objects")
async def get_reference_objects():
    """
    Returns list of supported reference objects with their dimensions
    
    Should return:
    - Object names and standard dimensions
    - Recommended usage guidelines
    - Detection confidence thresholds
    """
```

## Core Service Classes

### 1. Image Processor Service
```python
class ImageProcessor:
    def __init__(self):
        """Initialize OpenCV components and preprocessing parameters"""
        pass
    
    def preprocess_image(self, image_bytes: bytes) -> np.ndarray:
        """
        Preprocess uploaded image for analysis
        
        Should implement:
        - Image format conversion
        - Noise reduction
        - Lighting normalization
        - Rotation correction
        - Resize to optimal dimensions
        """
        pass
    
    def detect_reference_object(self, image: np.ndarray, ref_type: str) -> dict:
        """
        Detect and locate reference object in image
        
        Should implement:
        - Template matching or ML-based detection
        - Contour detection for geometric shapes
        - Confidence scoring
        - Bounding box extraction
        - Pixel dimension calculation
        """
        pass
    
    def calculate_pixel_scale(self, ref_detection: dict, ref_type: str) -> float:
        """
        Calculate pixels-per-unit scale from reference object
        
        Should implement:
        - Reference object dimension lookup
        - Pixel distance calculation
        - Scale factor computation
        - Perspective correction handling
        """
        pass
```

### 2. Object Detection Service
```python
class ObjectDetector:
    def __init__(self):
        """Load TensorFlow Lite model for object detection"""
        pass
    
    def detect_target_objects(self, image: np.ndarray) -> List[dict]:
        """
        Detect objects to be measured in the image
        
        Should implement:
        - TF Lite model inference
        - Object classification
        - Bounding box extraction
        - Confidence filtering
        - Multiple object handling
        """
        pass
    
    def extract_object_contours(self, image: np.ndarray, detection: dict) -> np.ndarray:
        """
        Extract precise contours of detected objects
        
        Should implement:
        - Region of interest extraction
        - Edge detection
        - Contour approximation
        - Noise filtering
        """
        pass
```

### 3. Measurement Calculator Service
```python
class MeasurementCalculator:
    def calculate_dimensions(self, contour: np.ndarray, pixel_scale: float) -> dict:
        """
        Calculate real-world dimensions from object contour
        
        Should implement:
        - Length measurement (longest dimension)
        - Width measurement (perpendicular to length)
        - Area calculation
        - Perimeter calculation
        - Unit conversions
        """
        pass
    
    def handle_perspective_correction(self, points: np.ndarray) -> np.ndarray:
        """
        Correct for camera angle and perspective distortion
        
        Should implement:
        - Perspective transformation matrix
        - Plane detection algorithms
        - Angle compensation
        - Distance correction factors
        """
        pass
```

## Data Models

### Request Models
```python
class MeasurementRequest(BaseModel):
    reference_object: str = Field(..., description="Type of reference object")
    measurement_type: str = Field(..., description="Type of measurement needed")
    units: str = Field(default="cm", description="Preferred output units")

class ReferenceObject(BaseModel):
    name: str
    dimensions: dict  # {"length": 8.56, "width": 5.398} for credit card
    detection_method: str
    confidence_threshold: float
```

### Response Models
```python
class MeasurementResult(BaseModel):
    success: bool
    measurements: dict  # {"length": 15.2, "width": 8.7, "area": 132.24}
    confidence: float
    reference_detected: bool
    processing_time: float
    errors: List[str] = []

class DetectionInfo(BaseModel):
    object_type: str
    confidence: float
    bounding_box: dict
    pixel_dimensions: dict
```

## Configuration Management

### Settings Class
```python
class Settings(BaseSettings):
    """
    Application configuration
    
    Should include:
    - File upload limits
    - Supported image formats
    - Model paths and parameters
    - Reference object database
    - API rate limiting settings
    - Logging configuration
    """
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    SUPPORTED_FORMATS: List[str] = ["jpg", "jpeg", "png", "bmp"]
    MODEL_PATH: str = "models/measurement_detector.tflite"
    CONFIDENCE_THRESHOLD: float = 0.7
```

## Error Handling Strategy

### Custom Exceptions
```python
class MeasurementError(Exception):
    """Base exception for measurement operations"""
    pass

class ReferenceObjectNotFound(MeasurementError):
    """Raised when reference object cannot be detected"""
    pass

class InsufficientImageQuality(MeasurementError):
    """Raised when image quality is too poor for analysis"""
    pass
```

### Error Handler Implementation
```python
@app.exception_handler(MeasurementError)
async def measurement_error_handler(request: Request, exc: MeasurementError):
    """
    Global error handler for measurement-related errors
    
    Should implement:
    - Structured error responses
    - Error logging
    - User-friendly error messages
    - Error code mapping
    """
    pass
```

## Integration Points

### 1. Shopify Webhook Handler
```python
@app.post("/shopify-webhook")
async def handle_shopify_webhook(request: Request):
    """
    Handle incoming webhooks from Shopify
    
    Should implement:
    - Webhook signature verification
    - Event type routing
    - Async processing queue
    - Response formatting for Shopify
    """
    pass
```

### 2. File Storage Integration
```python
class FileStorageService:
    def store_processed_image(self, image: np.ndarray, metadata: dict) -> str:
        """
        Store processed images with metadata
        
        Should implement:
        - Cloud storage upload (AWS S3/Google Cloud)
        - File naming conventions
        - Metadata tagging
        - Cleanup policies
        """
        pass
```

## Deployment Considerations

### Docker Configuration
```dockerfile
# Dockerfile should include:
# - Python 3.9+ base image
# - OpenCV and TensorFlow Lite dependencies
# - Model file copying
# - Environment variable configuration
# - Health check endpoint
```

### Environment Variables
```bash
# .env file should include:
ENVIRONMENT=production
LOG_LEVEL=INFO
DATABASE_URL=postgresql://...
STORAGE_BUCKET=measurement-photos
API_KEY_ENCRYPTION_SECRET=...
RATE_LIMIT_PER_MINUTE=60
```

## Testing Strategy

### Unit Tests Required
1. **Image preprocessing functions**
2. **Reference object detection accuracy**
3. **Measurement calculation precision**
4. **API endpoint responses**
5. **Error handling scenarios**

### Integration Tests Required
1. **End-to-end photo processing pipeline**
2. **File upload and validation**
3. **Database operations (if implemented)**
4. **External service integrations**

### Performance Tests Required
1. **Image processing speed benchmarks**
2. **Concurrent request handling**
3. **Memory usage optimization**
4. **Model inference latency**

## Implementation Priority

### Phase 1 (MVP)
1. Basic FastAPI setup with health check
2. Image upload and preprocessing
3. Simple reference object detection (credit card/ruler)
4. Basic length/width measurement
5. JSON response formatting

### Phase 2 (Enhanced)
1. Multiple reference object support
2. Advanced object detection with TF Lite
3. Perspective correction
4. Area and perimeter calculations
5. Confidence scoring

### Phase 3 (Production Ready)
1. Shopify integration
2. File storage and caching
3. Comprehensive error handling
4. Performance optimization
5. Monitoring and logging

## Success Metrics
- **Accuracy**: >90% measurement accuracy within 5% tolerance
- **Performance**: <5 second processing time per image
- **Reliability**: 99.9% uptime with proper error handling
- **Scalability**: Handle 100+ concurrent requests

This scope provides a comprehensive foundation for implementing the photo measurement extraction backend while maintaining flexibility for iterative development and testing.