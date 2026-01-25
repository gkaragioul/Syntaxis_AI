# Quick Reference - PDF to Excel Extractor

## Starting the Application

### Option 1: Docker (Recommended)
```bash
docker-compose -f docker-compose.new.yml up --build
```

### Option 2: Local
```bash
chmod +x start.sh
./start.sh
```

## Access URLs
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## First-Time Setup

1. **Register Account**: Go to http://localhost:3000/login → Click "Register"
2. **Create Template**: Dashboard → "Create New Template" → Upload test PDF
3. **Run Batch**: Dashboard → "Run Batch Extraction" → Select template + upload PDFs

## Test with Sample PDF

Sample PDF location: `/docs/project/DataSample.pdf` (226 pages, government financial report)

```bash
# Test extraction engine
cd services/api
python -c "
from extraction_engine import PDFExtractor
ext = PDFExtractor('../../docs/project/DataSample.pdf')
print('Pages:', ext.page_count)
print('Digital:', ext.is_digital_pdf())
ext.close()
"
```

## Running Tests

```bash
cd services/api
pip install -r requirements-test.txt
pytest test_extraction_engine.py test_excel_writer.py -v
```

## Common Commands

### API Server
```bash
cd services/api
uvicorn main:app --reload --port 8000
```

### Celery Worker
```bash
cd services/worker
celery -A celery_worker worker --loglevel=info
```

### Frontend
```bash
cd apps/web
npm install
npm run dev
```

### File Cleanup
```bash
cd services/api
python cleanup_job.py
```

## Environment Variables

Create `.env` in `services/api/`:
```
DATABASE_URL=sqlite:///./pdf_extractor.db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<generate-with-openssl-rand-hex-32>
```

## API Quick Reference

### Auth
```bash
# Register
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Upload PDF
```bash
curl -X POST http://localhost:8000/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/document.pdf"
```

### Create Template
```bash
curl -X POST http://localhost:8000/templates \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Balance Sheet Template",
    "description": "Extract balance sheet tables",
    "schema_json": {...}
  }'
```

## Troubleshooting

### Scanned PDF Error
**Error**: "Scanned PDF not supported in MVP"  
**Fix**: Use digital PDFs with selectable text. OCR not supported in MVP.

### Rate Limit Error
**Error**: "Rate limit exceeded"  
**Fix**: Wait or adjust limits in `services/api/rate_limiter.py`

### Docker Port Conflicts
**Error**: "Port already in use"  
**Fix**: Stop conflicting services or change ports in `docker-compose.new.yml`

### Celery Worker Not Processing
**Error**: Batch stuck in QUEUED  
**Fix**: Check Redis is running, restart worker

## File Limits

- Max PDF size: 50MB
- Max batch size: 200 PDFs
- File retention: 7 days (auto-cleanup)

## Rate Limits

- Upload: 10 requests/minute
- Batch: 5 requests/5 minutes
- Preview: 20 requests/minute

## Database

### SQLite (Development)
Location: `services/api/pdf_extractor.db`

### PostgreSQL (Production)
Connection string in `DATABASE_URL` environment variable

## Logs

### Docker
```bash
docker-compose -f docker-compose.new.yml logs -f api
docker-compose -f docker-compose.new.yml logs -f worker
docker-compose -f docker-compose.new.yml logs -f web
```

### Local
Check terminal output where services are running

## Support Files

- Full Documentation: `/README_NEW_APP.md`
- Implementation Summary: `/IMPLEMENTATION_SUMMARY.md`
- Original Spec: `/docs/project/New_Scope.md`
- Test PDF: `/docs/project/DataSample.pdf`
