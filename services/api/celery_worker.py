import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../worker"))

from celery_config import celery_app
import tasks
