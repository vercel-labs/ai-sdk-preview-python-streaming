import os
from sqlalchemy.orm import sessionmaker
from api.core.config import settings
from api.core.database import Base, engine

# Create a session to interact with the database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def reset_database():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database reset complete.")

def clear_uploads_directory():
    print(f"Clearing uploads directory: {settings.UPLOAD_DIR}...")
    if os.path.exists(settings.UPLOAD_DIR):
        for filename in os.listdir(settings.UPLOAD_DIR):
            file_path = os.path.join(settings.UPLOAD_DIR, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    os.rmdir(file_path) # Should ideally be rmtree, but for safety, only empty dirs will be removed
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
    else:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print("Uploads directory cleared.")

if __name__ == "__main__":
    reset_database()
    clear_uploads_directory()
    db.close() 