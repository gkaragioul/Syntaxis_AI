"""
Integration tests for the batch upload, fingerprint, and matching pipeline.
"""

import pytest
import tempfile
import os
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from io import BytesIO
import fitz  # PyMuPDF

# Import the app and models
from main import app, get_db, get_current_user
from models import Base, User, Document, Template, BatchJob, BatchJobItem
from database import get_db as original_get_db
from fingerprint_service import FingerprintService, TemplateMatcher, FingerprintV1

# Create test database
TEST_DATABASE_URL = "sqlite:///./test_batch_pipeline.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """Override database dependency for testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_test_user(db):
    """Create a test user in the database."""
    from auth import get_password_hash
    user = User(email="test@example.com", password_hash=get_password_hash("password123"))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def override_get_current_user():
    """Override auth dependency for testing."""
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == "test@example.com").first()
    if not user:
        user = create_test_user(db)
    db.close()
    return user


# Apply overrides
app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)


def create_test_pdf(text_content: str = "Invoice\nTotal: $100.00\nVendor: Test Corp") -> bytes:
    """Create a simple PDF with text content for testing."""
    doc = fitz.open()
    page = doc.new_page()

    # Add text to the page
    lines = text_content.split('\n')
    y_position = 72  # Start 1 inch from top

    for line in lines:
        page.insert_text((72, y_position), line, fontsize=12)
        y_position += 20

    # Save to bytes
    pdf_bytes = doc.write()
    doc.close()

    return pdf_bytes


@pytest.fixture(autouse=True)
def setup_database():
    """Set up test database before each test."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def test_user():
    """Create a test user."""
    db = TestingSessionLocal()
    user = create_test_user(db)
    db.close()
    return user


class TestFingerprintService:
    """Test fingerprint service directly."""

    def test_generate_fingerprint_from_pdf(self):
        """Test that we can generate a fingerprint from a PDF."""
        pdf_bytes = create_test_pdf("Invoice Number: 12345\nTotal Amount: $500.00\nVendor: Acme Corp")

        service = FingerprintService()
        fingerprint = service.generate_from_bytes(pdf_bytes)

        assert fingerprint.version == "1.0"
        assert fingerprint.is_scanned is False  # Should detect text
        assert fingerprint.page_count == 1
        assert len(fingerprint.top_keywords) > 0

    def test_scanned_pdf_detection(self):
        """Test that PDFs with no text are marked as scanned."""
        # Create a PDF with minimal text (below threshold)
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((72, 72), "x", fontsize=6)  # Very minimal text
        pdf_bytes = doc.write()
        doc.close()

        service = FingerprintService()
        fingerprint = service.generate_from_bytes(pdf_bytes)

        # Should be marked as scanned due to low text content
        assert fingerprint.is_scanned is True

    def test_fingerprint_stability(self):
        """Test that same PDF produces same fingerprint."""
        pdf_bytes = create_test_pdf("Consistent content for testing stability")

        service = FingerprintService()
        fp1 = service.generate_from_bytes(pdf_bytes)
        fp2 = service.generate_from_bytes(pdf_bytes)

        # Should produce identical fingerprints
        assert fp1.to_dict() == fp2.to_dict()


class TestTemplateMatcher:
    """Test template matching logic."""

    def test_match_similar_documents(self):
        """Test that similar documents match to the same template."""
        # Create template fingerprint
        template_fp = {
            "version": "1.0",
            "is_scanned": False,
            "page_count": 1,
            "top_keywords": ["invoice", "total", "vendor", "amount", "payment"],
            "blocks_signature": [],
            "column_x_signature": [{"page": 1, "xs_norm": [0.1, 0.5, 0.9]}],
            "header_footer_signature": {"header_text_hash": "abc", "footer_text_hash": "def"}
        }

        # Create similar document fingerprint
        doc_fp = FingerprintV1(
            is_scanned=False,
            page_count=1,
            top_keywords=["invoice", "total", "vendor", "due", "balance"],
            blocks_signature=[],
            column_x_signature=[{"page": 1, "xs_norm": [0.1, 0.5, 0.9]}],
            header_footer_signature={"header_text_hash": "abc", "footer_text_hash": "def"}
        )

        templates = [(1, "Invoice Template", template_fp)]

        matcher = TemplateMatcher()
        result = matcher.find_best_match(doc_fp, templates)

        assert result["template_id"] == 1
        assert result["confidence"] > 50

    def test_reject_dissimilar_documents(self):
        """Test that dissimilar documents don't match."""
        template_fp = {
            "version": "1.0",
            "is_scanned": False,
            "page_count": 1,
            "top_keywords": ["quarterly", "report", "financial", "earnings"],
            "blocks_signature": [],
            "column_x_signature": [{"page": 1, "xs_norm": [0.1, 0.2, 0.3, 0.4, 0.5]}],
            "header_footer_signature": {"header_text_hash": "xyz", "footer_text_hash": "123"}
        }

        doc_fp = FingerprintV1(
            is_scanned=False,
            page_count=1,
            top_keywords=["receipt", "store", "purchase", "cash"],
            blocks_signature=[],
            column_x_signature=[{"page": 1, "xs_norm": [0.2, 0.8]}],
            header_footer_signature={"header_text_hash": "999", "footer_text_hash": "888"}
        )

        templates = [(1, "Financial Report", template_fp)]

        matcher = TemplateMatcher()
        result = matcher.find_best_match(doc_fp, templates)

        # Should be unassigned due to low confidence
        assert result["status"] == "UNASSIGNED"


class TestBatchUploadAPI:
    """Test batch upload API endpoints."""

    def test_batch_upload_success(self, test_user):
        """Test successful batch upload."""
        pdf_bytes = create_test_pdf("Invoice for testing\nTotal: $250.00")

        files = [
            ("files", ("test1.pdf", BytesIO(pdf_bytes), "application/pdf")),
            ("files", ("test2.pdf", BytesIO(pdf_bytes), "application/pdf")),
        ]

        response = client.post("/documents/batch-upload", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "batch_id" in data
        assert "document_ids" in data
        assert len(data["document_ids"]) == 2

    def test_batch_upload_max_files(self, test_user):
        """Test that batch upload rejects too many files."""
        pdf_bytes = create_test_pdf("Test")

        # Create 101 files (over limit)
        files = [
            ("files", (f"test{i}.pdf", BytesIO(pdf_bytes), "application/pdf"))
            for i in range(101)
        ]

        response = client.post("/documents/batch-upload", files=files)

        assert response.status_code == 400
        assert "Maximum 100 files" in response.json()["detail"]

    def test_batch_upload_rejects_non_pdf(self, test_user):
        """Test that non-PDF files are skipped."""
        pdf_bytes = create_test_pdf("Valid PDF")
        txt_bytes = b"This is not a PDF"

        files = [
            ("files", ("valid.pdf", BytesIO(pdf_bytes), "application/pdf")),
            ("files", ("invalid.txt", BytesIO(txt_bytes), "text/plain")),
        ]

        response = client.post("/documents/batch-upload", files=files)

        assert response.status_code == 200
        data = response.json()
        # Only the PDF should be processed
        assert len(data["document_ids"]) == 1


class TestBatchListAPI:
    """Test batch list (inbox) API."""

    def test_list_batches_empty(self, test_user):
        """Test listing batches when none exist."""
        response = client.get("/batches")

        assert response.status_code == 200
        data = response.json()
        assert data["batches"] == []
        assert data["total"] == 0

    def test_list_batches_with_data(self, test_user):
        """Test listing batches after upload."""
        # First, upload some files
        pdf_bytes = create_test_pdf("Test content")
        files = [("files", ("test.pdf", BytesIO(pdf_bytes), "application/pdf"))]
        client.post("/documents/batch-upload", files=files)

        # Then list batches
        response = client.get("/batches")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["batches"]) >= 1


class TestBatchBucketSummary:
    """Test batch bucket summary API."""

    def test_get_batch_summary(self, test_user):
        """Test getting batch bucket summary."""
        pdf_bytes = create_test_pdf("Invoice content")
        files = [("files", ("test.pdf", BytesIO(pdf_bytes), "application/pdf"))]
        upload_response = client.post("/documents/batch-upload", files=files)
        batch_id = upload_response.json()["batch_id"]

        response = client.get(f"/batches/{batch_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["batch_id"] == batch_id
        assert "total_files" in data
        assert "template_buckets" in data
        assert "unassigned_bucket" in data
        assert "scanned_bucket" in data
        assert "error_bucket" in data


class TestTemplateCreation:
    """Test template creation with fingerprint."""

    def test_create_template_without_sample(self, test_user):
        """Test creating a template without a sample document."""
        response = client.post("/templates/with-fingerprint", json={
            "name": "Test Template",
            "description": "A test template",
            "schema_json": {"version": "1.0", "tables": []},
            "vendor_name": "Test Vendor",
            "report_type": "invoice"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Template"
        assert data["fingerprint_json"] is None  # No sample provided

    def test_create_template_with_sample(self, test_user):
        """Test creating a template with a sample document."""
        # First upload a document
        pdf_bytes = create_test_pdf("Sample invoice content")
        files = [("files", ("sample.pdf", BytesIO(pdf_bytes), "application/pdf"))]
        upload_response = client.post("/documents/batch-upload", files=files)
        doc_id = upload_response.json()["document_ids"][0]

        # Create template with sample
        response = client.post("/templates/with-fingerprint", json={
            "name": "Template From Sample",
            "schema_json": {"version": "1.0", "tables": []},
            "sample_document_id": doc_id
        })

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Template From Sample"
        assert data["fingerprint_json"] is not None  # Should have fingerprint


class TestRematch:
    """Test re-matching functionality."""

    def test_rematch_after_template_creation(self, test_user):
        """Test that rematch updates document matches."""
        # Upload documents
        pdf_bytes = create_test_pdf("Invoice with specific content")
        files = [("files", ("doc.pdf", BytesIO(pdf_bytes), "application/pdf"))]
        upload_response = client.post("/documents/batch-upload", files=files)
        batch_id = upload_response.json()["batch_id"]
        doc_id = upload_response.json()["document_ids"][0]

        # Create a template from the document
        client.post("/templates/with-fingerprint", json={
            "name": "New Template",
            "schema_json": {"version": "1.0", "tables": []},
            "sample_document_id": doc_id
        })

        # Re-match
        response = client.post(f"/batches/{batch_id}/rematch")

        assert response.status_code == 200
        data = response.json()
        assert "updated_count" in data


def cleanup():
    """Clean up test database."""
    if os.path.exists("./test_batch_pipeline.db"):
        os.remove("./test_batch_pipeline.db")


if __name__ == "__main__":
    try:
        pytest.main([__file__, "-v", "--tb=short"])
    finally:
        cleanup()
