import os
import time
from pathlib import Path
from datetime import datetime, timedelta

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
MAX_FILE_AGE_DAYS = 7

def cleanup_old_files():
    """Delete files older than MAX_FILE_AGE_DAYS"""
    
    cutoff_time = time.time() - (MAX_FILE_AGE_DAYS * 86400)
    deleted_count = 0
    
    for directory in [UPLOAD_DIR, OUTPUT_DIR]:
        if not directory.exists():
            continue
        
        for root, dirs, files in os.walk(directory):
            for filename in files:
                filepath = os.path.join(root, filename)
                
                try:
                    file_mtime = os.path.getmtime(filepath)
                    
                    if file_mtime < cutoff_time:
                        os.remove(filepath)
                        deleted_count += 1
                        print(f"Deleted old file: {filepath}")
                except Exception as e:
                    print(f"Error deleting {filepath}: {e}")
        
        for root, dirs, files in os.walk(directory, topdown=False):
            for dirname in dirs:
                dirpath = os.path.join(root, dirname)
                try:
                    if not os.listdir(dirpath):
                        os.rmdir(dirpath)
                        print(f"Deleted empty directory: {dirpath}")
                except Exception as e:
                    print(f"Error deleting directory {dirpath}: {e}")
    
    print(f"Cleanup complete. Deleted {deleted_count} files older than {MAX_FILE_AGE_DAYS} days.")
    return deleted_count

if __name__ == "__main__":
    cleanup_old_files()
