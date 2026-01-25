from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Enum, Text, BigInteger
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    documents = relationship("Document", back_populates="user")
    templates = relationship("Template", back_populates="user")
    batch_jobs = relationship("BatchJob", back_populates="user")

class DocumentMatchStatus(str, enum.Enum):
    PENDING = "PENDING"
    MATCHED = "MATCHED"
    UNASSIGNED = "UNASSIGNED"
    SCANNED = "SCANNED"
    ERROR = "ERROR"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    page_count = Column(Integer, nullable=False)
    sha256 = Column(String(64), index=True)
    fingerprint_json = Column(JSON, nullable=True)  # FingerprintV1 computed on upload
    match_status = Column(Enum(DocumentMatchStatus), default=DocumentMatchStatus.PENDING)
    matched_template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)
    match_confidence = Column(Integer, nullable=True)  # 0-100
    match_reasons = Column(JSON, nullable=True)  # Array of strings explaining match
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="documents")
    batch_items = relationship("BatchJobItem", back_populates="document")
    matched_template = relationship("Template", foreign_keys=[matched_template_id])

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    schema_json = Column(JSON, nullable=False)
    fingerprint_json = Column(JSON, nullable=True)  # FingerprintV1 from sample PDF
    vendor_name = Column(String, nullable=True)  # Human tag for vendor
    report_type = Column(String, nullable=True)  # Human tag for report type
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="templates")
    batch_jobs = relationship("BatchJob", back_populates="template")

class BatchJobStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"

class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True)  # Nullable for fingerprint-based batches
    status = Column(Enum(BatchJobStatus), default=BatchJobStatus.QUEUED, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="batch_jobs")
    template = relationship("Template", back_populates="batch_jobs")
    items = relationship("BatchJobItem", back_populates="batch_job", cascade="all, delete-orphan")

class BatchItemStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    WARNING = "WARNING"
    FAILED = "FAILED"

class BatchJobItem(Base):
    __tablename__ = "batch_job_items"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_job_id = Column(Integer, ForeignKey("batch_jobs.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(BatchItemStatus), nullable=True)
    warnings_json = Column(JSON, nullable=True)
    output_paths_json = Column(JSON, nullable=True)
    
    batch_job = relationship("BatchJob", back_populates="items")
    document = relationship("Document", back_populates="batch_items")
