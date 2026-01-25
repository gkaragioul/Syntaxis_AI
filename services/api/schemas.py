from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class DocumentUploadResponse(BaseModel):
    document_id: int
    filename: str
    page_count: int
    storage_path: str

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    schema_json: Dict[str, Any]

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    schema_json: Optional[Dict[str, Any]] = None

class TemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    schema_json: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BatchJobCreate(BaseModel):
    template_id: int
    document_ids: List[int]


class BatchUploadResponse(BaseModel):
    batch_id: int
    document_ids: List[int]
    message: str


class DocumentBucketItem(BaseModel):
    document_id: int
    filename: str
    match_status: str
    confidence: Optional[int] = None
    reasons: Optional[List[str]] = None


class TemplateBucket(BaseModel):
    template_id: int
    template_name: str
    vendor_name: Optional[str] = None
    file_count: int
    documents: List[DocumentBucketItem]


class BatchBucketSummary(BaseModel):
    batch_id: int
    status: str
    created_at: datetime
    finished_at: Optional[datetime] = None
    total_files: int
    matched_count: int
    unassigned_count: int
    scanned_count: int
    error_count: int
    template_buckets: List[TemplateBucket]
    unassigned_bucket: List[DocumentBucketItem]
    scanned_bucket: List[DocumentBucketItem]
    error_bucket: List[DocumentBucketItem]


class BatchJobStatusResponse(BaseModel):
    id: int
    status: str
    created_at: datetime
    finished_at: Optional[datetime]
    items: List[Dict[str, Any]]

    class Config:
        from_attributes = True


class BatchListItem(BaseModel):
    id: int
    status: str
    total_files: int
    matched_count: int
    unassigned_count: int
    created_at: datetime
    finished_at: Optional[datetime] = None


class BatchListResponse(BaseModel):
    batches: List[BatchListItem]
    total: int


class TemplateCreateWithFingerprint(BaseModel):
    name: str
    description: Optional[str] = None
    schema_json: Dict[str, Any]
    sample_document_id: Optional[int] = None  # Document to generate fingerprint from
    vendor_name: Optional[str] = None
    report_type: Optional[str] = None


class TemplateResponseWithFingerprint(BaseModel):
    id: int
    name: str
    description: Optional[str]
    schema_json: Dict[str, Any]
    fingerprint_json: Optional[Dict[str, Any]] = None
    vendor_name: Optional[str] = None
    report_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PreviewRequest(BaseModel):
    document_id: int
    template_schema_json: Dict[str, Any]

class PreviewResponse(BaseModel):
    grid_data: List[List[Any]]
    excel_url: str
    warnings: List[str] = []

class AnchorSchema(BaseModel):
    pageHint: Optional[int] = None
    text: str
    matchMode: Literal["exact", "contains", "regex"] = "contains"
    bboxOffset: Optional[Dict[str, float]] = None
    tolerancePx: int = 10

class TableRegionSchema(BaseModel):
    mode: Literal["relativeToAnchor", "absolute"]
    anchorId: Optional[str] = None
    bbox: Dict[str, float]

class HeaderSchema(BaseModel):
    depthRows: int = Field(ge=0, le=10)
    repeatEachPage: bool = False

class ColumnsSchema(BaseModel):
    mode: Literal["auto", "manualGuides"]
    guides: Optional[List[float]] = None

class CleanupSchema(BaseModel):
    dropEmptyRows: bool = True
    dropTotalsRows: bool = False
    totalsDetection: Optional[Dict[str, Any]] = None
    dropFootnotesArea: bool = False
    footnotesRegion: Optional[Dict[str, float]] = None

class OutputSchema(BaseModel):
    sheetName: str = "Sheet1"
    normalizeNumbers: bool = True
    keepCurrencySymbols: bool = False

class TableSchema(BaseModel):
    id: str
    pages: Any
    region: TableRegionSchema
    header: HeaderSchema
    columns: ColumnsSchema
    cleanup: CleanupSchema
    mergedCells: Dict[str, str]
    output: OutputSchema

class DriftDetectionSchema(BaseModel):
    requiredColumnCount: Optional[int] = None
    requiredHeaderKeywords: Optional[List[str]] = None
    maxAnchorDistancePx: int = 50
    failOnDrift: bool = False

class TemplateSchemaV1(BaseModel):
    version: str = "1.0"
    anchors: List[AnchorSchema] = []
    tables: List[TableSchema]
    tables: List[TableSchema]
    driftDetection: DriftDetectionSchema = DriftDetectionSchema()

class DetectTableRequest(BaseModel):
    file_path: str
    page_number: int = 1

class SnapSelectionRequest(BaseModel):
    file_path: str
    page_number: int = 1
    bbox_norm: Dict[str, float]


class ExtractPreviewRequest(BaseModel):
    file_path: str
    page_number: int = 1
    bbox_norm: Dict[str, float]
    column_guides: Optional[List[float]] = None
    column_boundaries: Optional[List[float]] = None  # Full column boundaries (preferred over guides)
    max_rows: int = 10
    use_grid_columns: bool = False  # Try to detect columns from grid lines
    force_mode: Optional[str] = None  # Force table mode: "ASCII_PIPE", "GRID_LINES", "TEXT_ALIGNMENT"


class DetectGridColumnsRequest(BaseModel):
    file_path: str
    page_number: int = 1
    bbox_norm: Dict[str, float]


class DetectColumnsRequest(BaseModel):
    file_path: str
    page_number: int = 1
    bbox_norm: Dict[str, float]
    mode: str = "gridlines"
