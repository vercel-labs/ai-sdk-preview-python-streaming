# Photo Measurement API

A FastAPI backend service that analyzes user-submitted photos to extract
real-world measurements using computer vision and AI models.

## Features

- Photo upload and processing
- Reference object detection
- Real-world measurement calculation
- Background task processing
- SQLite database storage

## API Endpoints

- `GET /api/v1/health` - Health check endpoint
- `POST /api/v1/photos` - Upload a new photo
- `GET /api/v1/photos` - List all photos
- `GET /api/v1/photos/{photo_id}` - Get photo details
- `POST /api/v1/photos/{photo_id}/process` - Process a photo
- `GET /api/v1/photos/{photo_id}/measurements` - Get measurements

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Run the server:

```bash
uvicorn api.main:app --reload
```

3. Access the API documentation:

```
http://localhost:8000/api/v1/docs
```

## Supported Reference Objects

- Credit Card (8.56cm x 5.398cm)
- Ruler (30cm)

## File Format Support

Supported image formats:

- JPG/JPEG
- PNG
- BMP

## Development

The project uses:

- FastAPI for the web framework
- OpenCV for image processing
- TensorFlow Lite for object detection
- SQLite for data storage
- Pydantic for data validation

## License

MIT
