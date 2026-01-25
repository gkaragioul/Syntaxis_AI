FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN pip install --no-cache-dir PyMuPDF pdfplumber openpyxl numpy scikit-learn sqlalchemy psycopg2-binary

COPY . .

CMD ["celery", "-A", "celery_worker", "worker", "--loglevel=info"]
