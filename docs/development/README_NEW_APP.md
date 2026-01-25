# PDF to Excel Extractor - SaaS MVP

A production-ready SaaS application for extracting tables from PDF documents and exporting to Excel with template-based batch processing.

## Features

- **Template-Based Extraction**: Create reusable templates for consistent PDF structures
- **Auto Table Detection**: Automatically detect candidate table regions in PDFs
- **Batch Processing**: Process hundreds of PDFs with a single template
- **Excel Export**: Clean .xlsx output with merged cells, headers, and number formatting
- **Digital PDF Only**: MVP supports digital PDFs with selectable text (OCR not included)
- **Drift Detection**: Warning system for layout changes between documents
- **Async Processing**: Celery-based worker queue for scalable batch jobs

## Architecture

```
/apps/web              - React + TypeScript frontend (Vite)
/services/api          - FastAPI backend with extraction engine
/services/worker       - Celery worker for async batch processing
/shared/types          - Shared TypeScript types
docker-compose.new.yml - Full stack orchestration
```

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM with PostgreSQL/SQLite support
- **PyMuPDF (fitz)** - Fast PDF text extraction
- **openpyxl** - Excel file generation with formatting
- **Celery + Redis** - Async task queue
- **JWT** - Stateless authentication

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **TanStack Query** - Server state management
- **pdf.js** - PDF rendering (placeholder in MVP)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- OR Python 3.11+, Node 18+, PostgreSQL, Redis

### Option 1: Docker (Recommended)

```bash
# Start all services
docker-compose -f docker-compose.new.yml up --build

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Option 2: Local Development

#### Backend Setup
```bash
cd services/api

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL="sqlite:///./pdf_extractor.db"
export SECRET_KEY="your-secret-key-here"
export REDIS_URL="redis://localhost:6379/0"

# Initialize database
python -c "from database import init_db; init_db()"

# Run API server
uvicorn main:app --reload --port 8000
```

#### Worker Setup (separate terminal)
```bash
cd services/worker

# Use same venv and environment
source ../api/venv/bin/activate
export DATABASE_URL="sqlite:///../api/pdf_extractor.db"
export REDIS_URL="redis://localhost:6379/0"

# Start worker
celery -A celery_worker worker --loglevel=info
```

#### Frontend Setup
```bash
cd apps/web

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Usage Workflow

### 1. Create Template
1. Navigate to "Create New Template"
2. Upload a representative PDF
3. System auto-detects table regions
4. Click detected regions to select
5. Configure:
   - Header row depth (0-10)
   - Column detection mode (auto/manual guides)
   - Number normalization rules
6. Preview extraction
7. Save template

### 2. Run Batch Extraction
1. Navigate to "Run Batch Extraction"
2. Select saved template
3. Upload multiple PDFs (up to 200)
4. Start batch job
5. Monitor progress (SUCCESS/WARNING/FAILED per file)
6. Download results as ZIP

### 3. Review Results
- Each PDF → separate Excel file
- Headers formatted (bold, frozen panes)
- Numbers normalized (remove commas, handle negatives)
- Merged cells preserved where detected
- Warnings logged for drift/layout changes

## API Endpoints

### Authentication
- `POST /auth/register` - Create account
- `POST /auth/login` - Get JWT token

### Documents
- `POST /documents/upload` - Upload PDF (max 50MB)
- `GET /documents/{id}` - Get document metadata
- `GET /documents/{id}/detect-tables` - Auto-detect table regions

### Templates
- `POST /templates` - Create template
- `GET /templates` - List user templates
- `GET /templates/{id}` - Get template details
- `PUT /templates/{id}` - Update template

### Preview
- `POST /preview` - Preview extraction on single PDF

### Batch Processing
- `POST /batch` - Create batch job
- `GET /batch/{id}/status` - Poll job status
- `GET /batch/{id}/download` - Download ZIP results

## Template Schema (v1.0)

```json
{
  "version": "1.0",
  "anchors": [
    {
      "id": "anchor_1",
      "text": "Balance Sheet",
      "matchMode": "contains",
      "tolerancePx": 10
    }
  ],
  "tables": [
    {
      "id": "main_table",
      "pages": "all",
      "region": {
        "mode": "absolute",
        "bbox": {"x0": 50, "y0": 100, "x1": 550, "y1": 700}
      },
      "header": {
        "depthRows": 1,
        "repeatEachPage": false
      },
      "columns": {
        "mode": "auto"
      },
      "cleanup": {
        "dropEmptyRows": true,
        "dropTotalsRows": false
      },
      "mergedCells": {
        "mode": "preserve"
      },
      "output": {
        "sheetName": "BalanceSheet",
        "normalizeNumbers": true,
        "keepCurrencySymbols": false
      }
    }
  ],
  "driftDetection": {
    "maxAnchorDistancePx": 50,
    "failOnDrift": false
  }
}
```

## Extraction Algorithm

1. **PDF Loading**: PyMuPDF opens document
2. **Digital Check**: Verify selectable text exists (reject scanned PDFs)
3. **Anchor Matching**: Locate stable text near tables (optional)
4. **Region Extraction**: Extract text spans in target bounding boxes
5. **Column Clustering**: Group spans by x-position (DBSCAN or manual guides)
6. **Row Clustering**: Group spans by y-position
7. **Grid Building**: Sort rows/columns into 2D array
8. **Header Handling**: Mark first N rows as headers
9. **Cleanup**: Drop empty rows, totals (regex matching)
10. **Number Normalization**: Parse `(1,234.00)` as `-1234`, strip currency
11. **Drift Detection**: Compare column count, check header keywords
12. **Excel Writing**: openpyxl with merges, formatting, freeze panes

## Testing

```bash
cd services/api

# Run unit tests
pytest test_extraction_engine.py test_excel_writer.py -v

# Test with sample PDF
python -c "
from extraction_engine import PDFExtractor
from excel_writer import ExcelWriter

ext = PDFExtractor('../../docs/project/DataSample.pdf')
print(f'Pages: {ext.page_count}')
print(f'Digital: {ext.is_digital_pdf()}')
ext.close()
"
```

## Security Considerations

### Implemented
- JWT authentication with secure password hashing (bcrypt)
- File size limits (50MB)
- PDF type validation (reject non-PDFs)
- User isolation (users can only access own files)
- SQL injection protection (SQLAlchemy ORM)

### TODO (Production Hardening)
- Rate limiting on upload/batch endpoints
- File cleanup job (delete files older than X days)
- CORS whitelist configuration
- HTTPS enforcement
- Input sanitization for template names
- API key rotation mechanism
- Audit logging for file access

## Environment Variables

```bash
# Backend (services/api)
DATABASE_URL=postgresql://user:pass@localhost:5432/pdf_extractor
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=<generate-with-openssl-rand-hex-32>

# Worker (services/worker)
DATABASE_URL=<same-as-backend>
REDIS_URL=<same-as-backend>

# Frontend (apps/web)
VITE_API_URL=http://localhost:8000
```

## Production Deployment

### Database Migration
```bash
# Create migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

### Scaling
- **API**: Horizontal scaling via load balancer
- **Worker**: Add more Celery workers (scale replicas)
- **Storage**: Switch to S3-compatible storage for uploads/outputs
- **Database**: PostgreSQL with read replicas

### Monitoring
- Health check: `GET /health`
- Celery Flower for worker monitoring
- PostgreSQL slow query log
- Redis memory usage

## Known Limitations (MVP)

1. **Scanned PDFs**: No OCR support (rejected with clear error)
2. **Complex Tables**: Nested headers, irregular grids may need manual guides
3. **Merged Cell Detection**: Best-effort heuristic, not 100% accurate
4. **PDF Rendering**: Frontend uses placeholder (integrate pdf.js in production)
5. **Template Versioning**: No migration path if schema changes
6. **Concurrent Edits**: No locking on templates

## Roadmap

- [ ] OCR support (Tesseract/Google Vision)
- [ ] Advanced merged cell detection
- [ ] Template versioning and migration
- [ ] Column guide drawing tool in UI
- [ ] Anchor-based relative positioning
- [ ] Multi-language support
- [ ] Export to CSV/JSON
- [ ] Combined workbook (all PDFs → one file, multiple sheets)
- [ ] Real-time extraction progress (WebSocket)

## Support

For issues and questions:
1. Check API documentation: http://localhost:8000/docs
2. Review sample test PDF: `/docs/project/DataSample.pdf`
3. Run unit tests to verify setup
4. Check worker logs for batch job errors

## License

Proprietary - Internal Use Only
