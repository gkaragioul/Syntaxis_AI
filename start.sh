#!/bin/bash

echo "=== PDF to Excel Extractor - Quick Start ==="
echo ""

# Check if Docker is available
if command -v docker-compose &> /dev/null; then
    echo "✓ Docker Compose found"
    echo ""
    echo "Starting all services with Docker..."
    echo ""
    docker-compose -f docker-compose.new.yml up --build
else
    echo "Docker Compose not found. Starting services manually..."
    echo ""
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        echo "✗ Python 3 not found. Please install Python 3.11+"
        exit 1
    fi
    
    # Check Node
    if ! command -v node &> /dev/null; then
        echo "✗ Node.js not found. Please install Node 18+"
        exit 1
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        echo "✗ Redis not found. Please install Redis and start it"
        exit 1
    fi
    
    echo "✓ All prerequisites found"
    echo ""
    
    # Start backend
    echo "Setting up backend..."
    cd services/api
    
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install -r requirements.txt
    
    export DATABASE_URL="sqlite:///./pdf_extractor.db"
    export SECRET_KEY="dev-secret-key-change-in-production"
    export REDIS_URL="redis://localhost:6379/0"
    
    python -c "from database import init_db; init_db()"
    
    echo "Starting API server on http://localhost:8000"
    uvicorn main:app --reload --port 8000 &
    API_PID=$!
    
    cd ../..
    
    # Start worker
    echo "Starting Celery worker..."
    cd services/worker
    
    source ../api/venv/bin/activate
    export DATABASE_URL="sqlite:///../api/pdf_extractor.db"
    export REDIS_URL="redis://localhost:6379/0"
    
    celery -A celery_worker worker --loglevel=info &
    WORKER_PID=$!
    
    cd ../..
    
    # Start frontend
    echo "Setting up frontend..."
    cd apps/web
    
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    echo "Starting frontend on http://localhost:3000"
    npm run dev &
    WEB_PID=$!
    
    cd ../..
    
    echo ""
    echo "=== Services Started ==="
    echo "Frontend: http://localhost:3000"
    echo "API: http://localhost:8000"
    echo "API Docs: http://localhost:8000/docs"
    echo ""
    echo "Press Ctrl+C to stop all services"
    echo ""
    
    # Wait for Ctrl+C
    trap "kill $API_PID $WORKER_PID $WEB_PID 2>/dev/null; exit" INT
    wait
fi
