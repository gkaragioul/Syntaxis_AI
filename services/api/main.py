from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import hashlib
import os
import shutil
from pathlib import Path

from database import get_db, init_db
from models import User, Document, Template, BatchJob, BatchJobItem, BatchJobStatus, BatchItemStatus, DocumentMatchStatus
from schemas import (
    UserCreate, UserLogin, UserResponse, TokenResponse, DocumentUploadResponse,
    TemplateCreate, TemplateUpdate, TemplateResponse, BatchJobCreate, BatchUploadResponse,
    DocumentBucketItem, TemplateBucket, BatchBucketSummary, BatchJobStatusResponse,
    BatchListItem, BatchListResponse, TemplateCreateWithFingerprint, TemplateResponseWithFingerprint,
    PreviewRequest, PreviewResponse, DetectTableRequest, SnapSelectionRequest, ExtractPreviewRequest,
    DetectGridColumnsRequest, DetectColumnsRequest
)
from auth import authenticate_user, create_access_token, get_password_hash, decode_access_token
from extraction_engine import PDFExtractor
from excel_writer import ExcelWriter
from table_detector import TableDetector
from rate_limiter import rate_limit_middleware
from fingerprint_service import FingerprintService, TemplateMatcher, compute_fingerprint
import fitz
from collections import defaultdict

app = FastAPI(title="PDF to Excel Extractor API")

security = HTTPBearer(auto_error=False)  # Don't require auth header

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(rate_limit_middleware)

UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)

@app.on_event("startup")
def startup_event():
    init_db()

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security), db: Session = Depends(get_db)) -> User:
    # AUTH BYPASS FOR FREE ACCESS - Always return a default test user
    email = "demo@syntaxis.ai"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Create demo user without password hashing (free access mode)
        user = User(email=email, password_hash="free_access_bypass")
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@app.post("/auth/register", response_model=TokenResponse)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, password_hash=hashed_password)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(data={"user_id": new_user.id})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(new_user)
    )

@app.post("/auth/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, user_data.email, user_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"user_id": user.id})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )

@app.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    if file.size and file.size > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 50MB limit")
    
    file_content = await file.read()
    
    sha256_hash = hashlib.sha256(file_content).hexdigest()
    
    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(exist_ok=True)
    
    storage_path = user_dir / f"{sha256_hash}.pdf"
    
    with open(storage_path, "wb") as f:
        f.write(file_content)
    
    try:
        doc = fitz.open(storage_path)
        page_count = len(doc)
        
        extractor = PDFExtractor(str(storage_path))
        if extractor.detect_scanned_pdf():
            doc.close()
            extractor.close()
            os.remove(storage_path)
            raise HTTPException(
                status_code=400,
                detail="Scanned PDF not supported in MVP. Please upload a digital PDF with selectable text."
            )
        extractor.close()
        doc.close()
        
    except Exception as e:
        if os.path.exists(storage_path):
            os.remove(storage_path)
        raise HTTPException(status_code=400, detail=f"Invalid PDF file: {str(e)}")
    
    new_doc = Document(
        user_id=current_user.id,
        filename=file.filename,
        storage_path=str(storage_path),
        page_count=page_count,
        sha256=sha256_hash
    )
    
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    return DocumentUploadResponse(
        document_id=new_doc.id,
        filename=new_doc.filename,
        page_count=new_doc.page_count,
        storage_path=new_doc.storage_path
    )

@app.get("/documents/{document_id}")
def get_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {
        "id": doc.id,
        "filename": doc.filename,
        "page_count": doc.page_count,
        "created_at": doc.created_at
    }

@app.get("/documents/{document_id}/render")
def get_document_content(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    if not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="File not found on server")
    
    return FileResponse(doc.storage_path, media_type="application/pdf")

@app.get("/documents/{document_id}/detect-tables")
def detect_tables(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        detector = TableDetector(doc.storage_path)
        # Old API detected all pages. New Logic is per-page.
        # For backward compatibility, we detect on first 3 pages?
        # Or just return empty compatible structure.
        # But wait, we modified TableDetector class completely.
        # Let's map it.
        detected_regions = {}
        for p in range(min(doc.page_count, 3)):
             candidates = detector.detect_candidates(p)
             # Map new candidate format to old format if needed?
             # Old format: list of dicts. New format: list of dicts.
             # Likely compatible enough.
             detected_regions[p] = candidates
        
        detector.close()
        
        return {
            "document_id": doc.id,
            "regions": detected_regions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

@app.post("/internal/detect-table")
def internal_detect_table(
    req: DetectTableRequest,
    db: Session = Depends(get_db)
):
    try:
        if not os.path.exists(req.file_path):
             raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")
        
        detector = TableDetector(req.file_path)
        # page_number is 1-based in API usually? Front end sends 1-based.
        # PyMuPDF is 0-based.
        candidates = detector.detect_candidates(req.page_number - 1)
        detector.close()
        
        return {
            "file_path": req.file_path,
            "page_number": req.page_number,
            "candidates": candidates,
            "recommended": candidates[0] if candidates else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

@app.post("/internal/snap-selection")
def internal_snap_selection(
    req: SnapSelectionRequest,
    db: Session = Depends(get_db)
):
    try:
        if not os.path.exists(req.file_path):
             raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

        detector = TableDetector(req.file_path)
        result = detector.snap_selection(req.page_number - 1, req.bbox_norm)
        detector.close()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Snap failed: {str(e)}")


@app.post("/internal/detect-grid-columns")
def internal_detect_grid_columns(
    req: DetectGridColumnsRequest,
    db: Session = Depends(get_db)
):
    """
    Detect column boundaries from vertical grid lines in a PDF region.
    Returns normalized x-positions of column separators.
    """
    try:
        if not os.path.exists(req.file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

        detector = TableDetector(req.file_path)
        result = detector.detect_grid_columns(req.page_number - 1, req.bbox_norm)
        detector.close()

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Grid column detection failed: {str(e)}")


@app.post("/internal/detect-columns")
def internal_detect_columns(
    req: DetectColumnsRequest,
    db: Session = Depends(get_db)
):
    """
    Detect column boundaries using a specified detection mode (gridlines or image_hough).
    """
    try:
        if not os.path.exists(req.file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

        detector = TableDetector(req.file_path)
        result = detector.detect_columns(req.page_number - 1, req.bbox_norm, req.mode)
        detector.close()

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Column detection failed: {str(e)}")


@app.post("/internal/extract-preview")
def internal_extract_preview(
    req: ExtractPreviewRequest,
    db: Session = Depends(get_db)
):
    """
    Extract table preview (headers and first N rows) from a selected region.
    Returns actual text content from the PDF for the confirm_headers step.

    Now supports automatic table mode detection (ASCII_PIPE, GRID_LINES, TEXT_ALIGNMENT).
    """
    try:
        if not os.path.exists(req.file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {req.file_path}")

        extractor = PDFExtractor(req.file_path)
        page_idx = req.page_number - 1

        if page_idx < 0 or page_idx >= extractor.page_count:
            extractor.close()
            raise HTTPException(status_code=400, detail=f"Invalid page number: {req.page_number}")

        page = extractor.doc[page_idx]
        page_width = page.rect.width
        page_height = page.rect.height

        # Convert normalized bbox to absolute coordinates
        bbox = (
            req.bbox_norm["x0"] * page_width,
            req.bbox_norm["y0"] * page_height,
            req.bbox_norm["x1"] * page_width,
            req.bbox_norm["y1"] * page_height,
        )

        # Determine column guides and boundaries
        absolute_guides = None
        absolute_boundaries = None
        grid_info = None

        # Priority 1: Use provided column_boundaries (from detectColumns call)
        if req.column_boundaries and len(req.column_boundaries) >= 2:
            absolute_boundaries = [b * page_width for b in req.column_boundaries]

        # Priority 2: If use_grid_columns is enabled, detect from PDF grid lines
        elif req.use_grid_columns:
            detector = TableDetector(req.file_path)
            grid_info = detector.detect_grid_columns(page_idx, req.bbox_norm)
            detector.close()

            if grid_info.get("has_grid") or grid_info.get("columns_detected", 0) >= 6:
                # Use column_boundaries if available (preferred - includes bbox edges)
                if grid_info.get("column_boundaries"):
                    absolute_boundaries = [b * page_width for b in grid_info["column_boundaries"]]
                elif grid_info.get("columns"):
                    # Fall back to converting separators to boundaries
                    absolute_guides = [c * page_width for c in grid_info["columns"]]

        # Priority 3: Fall back to provided column guides
        if absolute_boundaries is None and absolute_guides is None and req.column_guides:
            absolute_guides = [g * page_width for g in req.column_guides]

        # Use mode-aware extraction
        # Get force_mode from request if provided (for manual override)
        force_mode = req.force_mode

        extraction_result = extractor.extract_with_mode(
            page=page,
            bbox=bbox,
            page_num=page_idx,
            column_guides=absolute_guides,
            column_boundaries=absolute_boundaries,
            grid_info=grid_info,
            force_mode=force_mode
        )

        extractor.close()

        grid = extraction_result["grid"]
        mode_detection = extraction_result["modeDetection"]
        header_detection = extraction_result["headerDetection"]

        # Limit rows for preview
        limited_grid = grid[:req.max_rows] if grid else []

        # Extract headers (first row) and data rows
        headers = limited_grid[0] if limited_grid else []
        rows = limited_grid[1:] if len(limited_grid) > 1 else []

        response = {
            "headers": headers,
            "rows": rows,
            "totalRows": extraction_result["totalRows"],
            "totalCols": extraction_result["totalCols"],
            "headerDetection": header_detection,
            "modeDetection": mode_detection,
            "tableMode": extraction_result["mode"],
        }

        # Include grid info if we detected it
        if grid_info:
            response["gridInfo"] = grid_info

        # Include separator rows if ASCII_PIPE mode
        if extraction_result.get("separatorRows"):
            response["separatorRows"] = extraction_result["separatorRows"]

        # Include diagnostics for debugging
        if extraction_result.get("diagnostics"):
            response["diagnostics"] = extraction_result["diagnostics"]

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview extraction failed: {str(e)}")

@app.post("/templates", response_model=TemplateResponse)
def create_template(
    template_data: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_template = Template(
        user_id=current_user.id,
        name=template_data.name,
        description=template_data.description,
        schema_json=template_data.schema_json
    )
    
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    
    return TemplateResponse.model_validate(new_template)

@app.get("/templates", response_model=List[TemplateResponse])
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    templates = db.query(Template).filter(Template.user_id == current_user.id).all()
    return [TemplateResponse.model_validate(t) for t in templates]

@app.get("/templates/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return TemplateResponse.model_validate(template)

@app.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    template_data: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.description is not None:
        template.description = template_data.description
    if template_data.schema_json is not None:
        template.schema_json = template_data.schema_json
    
    db.commit()
    db.refresh(template)

    return TemplateResponse.model_validate(template)

@app.delete("/templates/{template_id}")
def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a template by ID."""
    template = db.query(Template).filter(
        Template.id == template_id,
        Template.user_id == current_user.id
    ).first()

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Simply delete the template - no foreign key constraints to worry about
    db.delete(template)
    db.commit()

    return {"message": "Template deleted successfully"}

@app.post("/preview", response_model=PreviewResponse)
def preview_extraction(
    preview_req: PreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc = db.query(Document).filter(
        Document.id == preview_req.document_id,
        Document.user_id == current_user.id
    ).first()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        extractor = PDFExtractor(doc.storage_path)
        template_schema = preview_req.template_schema_json
        
        warnings = []
        all_grids = []
        
        for table_config in template_schema.get("tables", []):
            region = table_config.get("region", {})
            pages_config = table_config.get("pages", "all")
            
            if pages_config == "all":
                target_pages = range(extractor.page_count)
            else:
                target_pages = [p - 1 for p in pages_config]
            
            for page_num in target_pages:
                if page_num >= extractor.page_count:
                    continue
                
                page = extractor.doc[page_num]
                
                bbox = None
                if region.get("mode") == "absolute":
                    bbox_config = region.get("bbox", {})
                    bbox = (
                        bbox_config.get("x0", 0),
                        bbox_config.get("y0", 0),
                        bbox_config.get("x1", page.rect.width),
                        bbox_config.get("y1", page.rect.height)
                    )
                elif region.get("mode") == "relativeToAnchor":
                    anchor_id = region.get("anchorId")
                    if anchor_id:
                        anchors = template_schema.get("anchors", [])
                        anchor_config = next((a for a in anchors if a.get("id") == anchor_id), None)
                        if anchor_config:
                            anchor_bbox = extractor.find_anchor(page, anchor_config)
                            if anchor_bbox:
                                offset = region.get("bbox", {})
                                bbox = (
                                    anchor_bbox[0] + offset.get("x0", 0),
                                    anchor_bbox[1] + offset.get("y0", 0),
                                    anchor_bbox[2] + offset.get("x1", 0),
                                    anchor_bbox[3] + offset.get("y1", 0)
                                )
                            else:
                                warnings.append(f"Anchor not found on page {page_num + 1}")
                                bbox = (0, 0, page.rect.width, page.rect.height)
                
                if bbox:
                    spans = extractor.extract_text_spans(page, bbox, page_num)
                    
                    columns_config = table_config.get("columns", {})
                    guides = columns_config.get("guides") if columns_config.get("mode") == "manualGuides" else None
                    
                    grid = extractor.build_grid(spans, guides)
                    all_grids.extend(grid)
        
        extractor.close()
        
        output_dir = OUTPUT_DIR / str(current_user.id)
        output_dir.mkdir(exist_ok=True)
        
        excel_path = output_dir / f"preview_{doc.id}.xlsx"
        
        writer = ExcelWriter()
        header_depth = template_schema.get("tables", [{}])[0].get("header", {}).get("depthRows", 0)
        writer.write_grid(all_grids, "Preview", header_depth=header_depth)
        writer.save(str(excel_path))
        writer.close()
        
        return PreviewResponse(
            grid_data=all_grids[:100],
            excel_url=f"/outputs/{current_user.id}/preview_{doc.id}.xlsx",
            warnings=warnings
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

@app.get("/outputs/{user_id}/{filename}")
def download_output(
    user_id: int,
    filename: str,
    current_user: User = Depends(get_current_user)
):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    file_path = OUTPUT_DIR / str(user_id) / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)


# =============================================================================
# BATCH UPLOAD & FINGERPRINTING ENDPOINTS
# =============================================================================

@app.post("/documents/batch-upload", response_model=BatchUploadResponse)
async def batch_upload_documents(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload multiple PDFs, compute fingerprints, and match to templates.
    Returns batch_id and document_ids for tracking.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    if len(files) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 files per batch")

    # Create batch job (without template - will be assigned per-document)
    new_batch = BatchJob(
        user_id=current_user.id,
        template_id=None,  # No single template for batch upload
        status=BatchJobStatus.QUEUED
    )
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)

    document_ids = []
    fingerprint_service = FingerprintService()
    matcher = TemplateMatcher()

    # Get all user's templates with fingerprints for matching
    templates = db.query(Template).filter(
        Template.user_id == current_user.id,
        Template.fingerprint_json.isnot(None)
    ).all()
    template_list = [(t.id, t.name, t.fingerprint_json) for t in templates]

    user_dir = UPLOAD_DIR / str(current_user.id)
    user_dir.mkdir(exist_ok=True)

    for file in files:
        try:
            if not file.filename.endswith('.pdf'):
                # Skip non-PDF files with error status
                continue

            file_content = await file.read()
            sha256_hash = hashlib.sha256(file_content).hexdigest()
            storage_path = user_dir / f"{sha256_hash}.pdf"

            with open(storage_path, "wb") as f:
                f.write(file_content)

            # Get page count
            doc = fitz.open(storage_path)
            page_count = len(doc)
            doc.close()

            # Compute fingerprint
            try:
                fingerprint = fingerprint_service.generate(str(storage_path))
                fingerprint_dict = fingerprint.to_dict()

                # Determine match status
                if fingerprint.is_scanned:
                    match_status = DocumentMatchStatus.SCANNED
                    matched_template_id = None
                    match_confidence = None
                    match_reasons = ["Document appears to be scanned (insufficient text for extraction)"]
                else:
                    # Match against templates
                    match_result = matcher.find_best_match(fingerprint, template_list)
                    match_status = DocumentMatchStatus(match_result["status"])
                    matched_template_id = match_result.get("template_id")
                    match_confidence = match_result.get("confidence")
                    match_reasons = match_result.get("reasons", [])

            except Exception as e:
                fingerprint_dict = None
                match_status = DocumentMatchStatus.ERROR
                matched_template_id = None
                match_confidence = None
                match_reasons = [f"Fingerprint computation failed: {str(e)}"]

            # Create document record
            new_doc = Document(
                user_id=current_user.id,
                filename=file.filename,
                storage_path=str(storage_path),
                page_count=page_count,
                sha256=sha256_hash,
                fingerprint_json=fingerprint_dict,
                match_status=match_status,
                matched_template_id=matched_template_id,
                match_confidence=match_confidence,
                match_reasons=match_reasons
            )
            db.add(new_doc)
            db.commit()
            db.refresh(new_doc)

            document_ids.append(new_doc.id)

            # Create batch item
            item = BatchJobItem(
                batch_job_id=new_batch.id,
                document_id=new_doc.id
            )
            db.add(item)

        except Exception as e:
            # Log error but continue with other files
            print(f"Error processing file {file.filename}: {str(e)}")
            continue

    db.commit()

    return BatchUploadResponse(
        batch_id=new_batch.id,
        document_ids=document_ids,
        message=f"Uploaded {len(document_ids)} documents successfully"
    )


@app.get("/batches", response_model=BatchListResponse)
def list_batches(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all batch jobs for the current user (inbox view).
    """
    total = db.query(BatchJob).filter(BatchJob.user_id == current_user.id).count()

    batches = db.query(BatchJob).filter(
        BatchJob.user_id == current_user.id
    ).order_by(BatchJob.created_at.desc()).offset(skip).limit(limit).all()

    batch_list = []
    for batch in batches:
        # Count documents by status
        matched_count = 0
        unassigned_count = 0
        total_files = len(batch.items)

        for item in batch.items:
            doc = db.query(Document).filter(Document.id == item.document_id).first()
            if doc:
                if doc.match_status == DocumentMatchStatus.MATCHED:
                    matched_count += 1
                elif doc.match_status in [DocumentMatchStatus.UNASSIGNED, DocumentMatchStatus.PENDING]:
                    unassigned_count += 1

        batch_list.append(BatchListItem(
            id=batch.id,
            status=batch.status.value,
            total_files=total_files,
            matched_count=matched_count,
            unassigned_count=unassigned_count,
            created_at=batch.created_at,
            finished_at=batch.finished_at
        ))

    return BatchListResponse(batches=batch_list, total=total)


@app.get("/batches/{batch_id}", response_model=BatchBucketSummary)
def get_batch_bucket_summary(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get batch with bucket summary showing documents grouped by matched template.
    """
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()

    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    # Group documents by status and template
    template_buckets: Dict[int, List[DocumentBucketItem]] = defaultdict(list)
    unassigned_bucket: List[DocumentBucketItem] = []
    scanned_bucket: List[DocumentBucketItem] = []
    error_bucket: List[DocumentBucketItem] = []

    matched_count = 0
    unassigned_count = 0
    scanned_count = 0
    error_count = 0

    for item in batch_job.items:
        doc = db.query(Document).filter(Document.id == item.document_id).first()
        if not doc:
            continue

        doc_item = DocumentBucketItem(
            document_id=doc.id,
            filename=doc.filename,
            match_status=doc.match_status.value if doc.match_status else "PENDING",
            confidence=doc.match_confidence,
            reasons=doc.match_reasons
        )

        if doc.match_status == DocumentMatchStatus.MATCHED and doc.matched_template_id:
            template_buckets[doc.matched_template_id].append(doc_item)
            matched_count += 1
        elif doc.match_status == DocumentMatchStatus.SCANNED:
            scanned_bucket.append(doc_item)
            scanned_count += 1
        elif doc.match_status == DocumentMatchStatus.ERROR:
            error_bucket.append(doc_item)
            error_count += 1
        else:
            unassigned_bucket.append(doc_item)
            unassigned_count += 1

    # Build template bucket objects
    template_bucket_list = []
    for template_id, docs in template_buckets.items():
        template = db.query(Template).filter(Template.id == template_id).first()
        if template:
            template_bucket_list.append(TemplateBucket(
                template_id=template.id,
                template_name=template.name,
                vendor_name=template.vendor_name,
                file_count=len(docs),
                documents=docs
            ))

    return BatchBucketSummary(
        batch_id=batch_job.id,
        status=batch_job.status.value,
        created_at=batch_job.created_at,
        finished_at=batch_job.finished_at,
        total_files=len(batch_job.items),
        matched_count=matched_count,
        unassigned_count=unassigned_count,
        scanned_count=scanned_count,
        error_count=error_count,
        template_buckets=template_bucket_list,
        unassigned_bucket=unassigned_bucket,
        scanned_bucket=scanned_bucket,
        error_bucket=error_bucket
    )


@app.delete("/batches/{batch_id}")
def delete_batch(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a batch and all its associated items and documents."""
    batch = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()

    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    # Get all document IDs in this batch
    batch_items = db.query(BatchJobItem).filter(BatchJobItem.batch_job_id == batch_id).all()
    doc_ids = [item.document_id for item in batch_items]

    # Delete batch items first
    db.query(BatchJobItem).filter(BatchJobItem.batch_job_id == batch_id).delete()

    # Delete associated documents and their files
    for doc_id in doc_ids:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            if doc.storage_path and os.path.exists(doc.storage_path):
                os.remove(doc.storage_path)
            db.delete(doc)

    # Delete the batch itself
    db.delete(batch)
    db.commit()

    return {"message": f"Batch {batch_id} and {len(doc_ids)} documents deleted successfully"}


@app.post("/batches/{batch_id}/run")
def run_batch_extraction(
    batch_id: int,
    template_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Run extraction on a batch. If template_id is provided, only extract documents
    matched to that template. Otherwise, extract all matched documents.
    """
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()

    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    # Get documents to process
    docs_to_process = []
    for item in batch_job.items:
        doc = db.query(Document).filter(Document.id == item.document_id).first()
        if not doc:
            continue

        # Filter by template if specified
        if template_id:
            if doc.matched_template_id == template_id:
                docs_to_process.append((doc, item))
        else:
            # Only process matched documents
            if doc.match_status == DocumentMatchStatus.MATCHED and doc.matched_template_id:
                docs_to_process.append((doc, item))

    if not docs_to_process:
        raise HTTPException(status_code=400, detail="No documents to process")

    # Update batch status
    batch_job.status = BatchJobStatus.RUNNING
    db.commit()

    # Trigger Celery task
    from celery_worker import process_batch_job_v2
    process_batch_job_v2.delay(batch_id, template_id)

    return {
        "message": f"Extraction started for {len(docs_to_process)} documents",
        "batch_id": batch_id,
        "documents_count": len(docs_to_process)
    }


@app.post("/batches/{batch_id}/rematch")
def rematch_batch_documents(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Re-run matching for all unassigned documents in a batch.
    Useful after creating a new template.
    """
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()

    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    # Get all templates with fingerprints
    templates = db.query(Template).filter(
        Template.user_id == current_user.id,
        Template.fingerprint_json.isnot(None)
    ).all()
    template_list = [(t.id, t.name, t.fingerprint_json) for t in templates]

    if not template_list:
        raise HTTPException(status_code=400, detail="No templates with fingerprints available")

    matcher = TemplateMatcher()
    updated_count = 0

    for item in batch_job.items:
        doc = db.query(Document).filter(Document.id == item.document_id).first()
        if not doc:
            continue

        # Only rematch unassigned/pending documents (not scanned or error)
        if doc.match_status not in [DocumentMatchStatus.UNASSIGNED, DocumentMatchStatus.PENDING]:
            continue

        if not doc.fingerprint_json:
            continue

        # Re-run matching
        from fingerprint_service import FingerprintV1
        doc_fp = FingerprintV1.from_dict(doc.fingerprint_json)
        match_result = matcher.find_best_match(doc_fp, template_list)

        doc.match_status = DocumentMatchStatus(match_result["status"])
        doc.matched_template_id = match_result.get("template_id")
        doc.match_confidence = match_result.get("confidence")
        doc.match_reasons = match_result.get("reasons", [])
        updated_count += 1

    db.commit()

    return {
        "message": f"Re-matched {updated_count} documents",
        "batch_id": batch_id,
        "updated_count": updated_count
    }


@app.post("/templates/with-fingerprint", response_model=TemplateResponseWithFingerprint)
def create_template_with_fingerprint(
    template_data: TemplateCreateWithFingerprint,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new template, optionally computing fingerprint from a sample document.
    """
    fingerprint_json = None

    # If sample document provided, compute fingerprint from it
    if template_data.sample_document_id:
        doc = db.query(Document).filter(
            Document.id == template_data.sample_document_id,
            Document.user_id == current_user.id
        ).first()

        if not doc:
            raise HTTPException(status_code=404, detail="Sample document not found")

        # Use document's existing fingerprint or compute new one
        if doc.fingerprint_json:
            fingerprint_json = doc.fingerprint_json
        else:
            try:
                fingerprint_service = FingerprintService()
                fp = fingerprint_service.generate(doc.storage_path)
                fingerprint_json = fp.to_dict()
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to compute fingerprint: {str(e)}")

    new_template = Template(
        user_id=current_user.id,
        name=template_data.name,
        description=template_data.description,
        schema_json=template_data.schema_json,
        fingerprint_json=fingerprint_json,
        vendor_name=template_data.vendor_name,
        report_type=template_data.report_type
    )

    db.add(new_template)
    db.commit()
    db.refresh(new_template)

    return TemplateResponseWithFingerprint.model_validate(new_template)


@app.post("/batch", response_model=Dict)
def create_batch_job(
    batch_data: BatchJobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    template = db.query(Template).filter(
        Template.id == batch_data.template_id,
        Template.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    new_batch = BatchJob(
        user_id=current_user.id,
        template_id=batch_data.template_id,
        status=BatchJobStatus.QUEUED
    )
    
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)
    
    for doc_id in batch_data.document_ids:
        doc = db.query(Document).filter(
            Document.id == doc_id,
            Document.user_id == current_user.id
        ).first()
        
        if doc:
            item = BatchJobItem(
                batch_job_id=new_batch.id,
                document_id=doc.id
            )
            db.add(item)
    
    db.commit()
    
    from celery_worker import process_batch_job
    process_batch_job.delay(new_batch.id)
    
    return {
        "batch_job_id": new_batch.id,
        "status": new_batch.status.value,
        "message": "Batch job queued successfully"
    }

@app.get("/batch/{batch_id}/status", response_model=BatchJobStatusResponse)
def get_batch_status(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()
    
    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    
    items_data = []
    for item in batch_job.items:
        items_data.append({
            "document_id": item.document_id,
            "status": item.status.value if item.status else "PENDING",
            "warnings": item.warnings_json,
            "output_paths": item.output_paths_json
        })
    
    return BatchJobStatusResponse(
        id=batch_job.id,
        status=batch_job.status.value,
        created_at=batch_job.created_at,
        finished_at=batch_job.finished_at,
        items=items_data
    )

@app.get("/batch/{batch_id}/download")
def download_batch_results(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()
    
    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")
    
    if batch_job.status != BatchJobStatus.DONE:
        raise HTTPException(status_code=400, detail="Batch job not completed yet")
    
    zip_path = OUTPUT_DIR / str(current_user.id) / f"batch_{batch_id}" / f"batch_{batch_id}_results.zip"
    
    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")
    
    return FileResponse(zip_path, filename=f"batch_{batch_id}_results.zip")


@app.get("/batches/{batch_id}/download")
def download_batch_results_v2(
    batch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download batch results (new endpoint path)."""
    batch_job = db.query(BatchJob).filter(
        BatchJob.id == batch_id,
        BatchJob.user_id == current_user.id
    ).first()

    if not batch_job:
        raise HTTPException(status_code=404, detail="Batch job not found")

    if batch_job.status != BatchJobStatus.DONE:
        raise HTTPException(status_code=400, detail="Batch job not completed yet")

    zip_path = OUTPUT_DIR / str(current_user.id) / f"batch_{batch_id}" / f"batch_{batch_id}_results.zip"

    if not zip_path.exists():
        raise HTTPException(status_code=404, detail="Results not found")

    return FileResponse(zip_path, filename=f"batch_{batch_id}_results.zip")


# =============================================================================
# INVOICES API (compatibility layer for frontend)
# =============================================================================

@app.get("/api/v1/invoices")
def list_invoices(
    page: int = 1,
    limit: int = 10,
    search: str = "",
    status: str = "",
    sortBy: str = "createdAt",
    sortOrder: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List invoices (documents) with pagination and filtering.
    This endpoint provides compatibility with the frontend InvoiceList component.
    """
    query = db.query(Document).filter(Document.user_id == current_user.id)

    # Apply search filter
    if search:
        query = query.filter(Document.filename.ilike(f"%{search}%"))

    # Apply status filter (map to match_status)
    if status:
        status_map = {
            "processed": DocumentMatchStatus.MATCHED,
            "processing": DocumentMatchStatus.PENDING,
            "failed": DocumentMatchStatus.ERROR,
        }
        if status in status_map:
            query = query.filter(Document.match_status == status_map[status])

    # Get total count
    total = query.count()

    # Apply sorting
    sort_column = Document.created_at  # default
    if sortBy == "filename":
        sort_column = Document.filename
    elif sortBy == "createdAt":
        sort_column = Document.created_at

    if sortOrder == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * limit
    documents = query.offset(offset).limit(limit).all()

    # Convert to invoice format expected by frontend
    invoices = []
    for doc in documents:
        # Map document status to invoice status
        inv_status = "processed"
        if doc.match_status == DocumentMatchStatus.PENDING:
            inv_status = "processing"
        elif doc.match_status == DocumentMatchStatus.ERROR:
            inv_status = "failed"
        elif doc.match_status == DocumentMatchStatus.MATCHED:
            inv_status = "processed"

        invoices.append({
            "id": str(doc.id),
            "filename": doc.filename,
            "invoiceNumber": f"INV-{doc.id:06d}",
            "vendorName": "Unknown",
            "invoiceDate": doc.created_at.isoformat() if doc.created_at else None,
            "dueDate": None,
            "totalAmount": 0,
            "subtotal": 0,
            "taxAmount": 0,
            "status": inv_status,
            "confidenceScore": doc.match_confidence,
            "createdAt": doc.created_at.isoformat() if doc.created_at else None,
            "updatedAt": doc.created_at.isoformat() if doc.created_at else None,
        })

    return {
        "invoices": invoices,
        "total": total,
        "page": page,
        "limit": limit,
    }


@app.get("/api/v1/invoices/{invoice_id}")
def get_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single invoice by ID."""
    try:
        doc_id = int(invoice_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invoice not found")

    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    inv_status = "processed"
    if doc.match_status == DocumentMatchStatus.PENDING:
        inv_status = "processing"
    elif doc.match_status == DocumentMatchStatus.ERROR:
        inv_status = "failed"

    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "invoiceNumber": f"INV-{doc.id:06d}",
        "vendorName": "Unknown",
        "invoiceDate": doc.created_at.isoformat() if doc.created_at else None,
        "dueDate": None,
        "totalAmount": 0,
        "subtotal": 0,
        "taxAmount": 0,
        "status": inv_status,
        "confidenceScore": doc.match_confidence,
        "createdAt": doc.created_at.isoformat() if doc.created_at else None,
        "updatedAt": doc.created_at.isoformat() if doc.created_at else None,
    }


@app.delete("/api/v1/invoices/{invoice_id}")
def delete_invoice(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an invoice by ID."""
    try:
        doc_id = int(invoice_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Invoice not found")

    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.user_id == current_user.id
    ).first()

    if not doc:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Delete related batch job items first (foreign key constraint)
    db.query(BatchJobItem).filter(BatchJobItem.document_id == doc_id).delete()

    # Delete the file if it exists
    if doc.storage_path and os.path.exists(doc.storage_path):
        os.remove(doc.storage_path)

    db.delete(doc)
    db.commit()

    return {"message": "Invoice deleted successfully"}


@app.get("/api/v1/notifications")
def list_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return empty notifications list for now."""
    return {"notifications": [], "unread_count": 0}


@app.get("/api/v1/health")
def health_check_v1():
    """Health check endpoint for API v1."""
    return {"status": "ok"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
