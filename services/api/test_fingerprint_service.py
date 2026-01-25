"""
Tests for the Document Style Fingerprint Service
"""

import pytest
from fingerprint_service import (
    FingerprintService,
    FingerprintV1,
    TemplateMatcher,
    compute_fingerprint,
    match_document_to_templates
)


class TestFingerprintV1:
    """Tests for FingerprintV1 data structure."""

    def test_to_dict_returns_correct_structure(self):
        """Test that to_dict returns all required fields."""
        fp = FingerprintV1(
            is_scanned=False,
            page_count=2,
            top_keywords=["invoice", "total", "amount"],
            blocks_signature=[{"page": 1, "region_id": 0, "bbox_norm": {"x0": 0, "y0": 0, "x1": 0.1, "y1": 0.1}, "density": 10}],
            column_x_signature=[{"page": 1, "xs_norm": [0.1, 0.5, 0.9]}],
            header_footer_signature={"header_text_hash": "abc123", "footer_text_hash": "def456"}
        )

        result = fp.to_dict()

        assert result["version"] == "1.0"
        assert result["is_scanned"] is False
        assert result["page_count"] == 2
        assert result["top_keywords"] == ["invoice", "total", "amount"]
        assert len(result["blocks_signature"]) == 1
        assert len(result["column_x_signature"]) == 1
        assert "header_text_hash" in result["header_footer_signature"]

    def test_from_dict_creates_correct_instance(self):
        """Test that from_dict correctly reconstructs a FingerprintV1."""
        data = {
            "version": "1.0",
            "is_scanned": True,
            "page_count": 5,
            "top_keywords": ["receipt", "store"],
            "blocks_signature": [],
            "column_x_signature": [{"page": 1, "xs_norm": [0.2, 0.8]}],
            "header_footer_signature": {"header_text_hash": "hash1", "footer_text_hash": "hash2"}
        }

        fp = FingerprintV1.from_dict(data)

        assert fp.is_scanned is True
        assert fp.page_count == 5
        assert fp.top_keywords == ["receipt", "store"]

    def test_roundtrip_conversion(self):
        """Test that to_dict -> from_dict preserves data."""
        original = FingerprintV1(
            is_scanned=False,
            page_count=3,
            top_keywords=["vendor", "balance", "sheet"],
            blocks_signature=[{"page": 1, "region_id": 5, "bbox_norm": {"x0": 0.1, "y0": 0.2, "x1": 0.3, "y1": 0.4}, "density": 15}],
            column_x_signature=[{"page": 1, "xs_norm": [0.15, 0.45, 0.75]}],
            header_footer_signature={"header_text_hash": "xyz", "footer_text_hash": "abc"}
        )

        restored = FingerprintV1.from_dict(original.to_dict())

        assert restored.is_scanned == original.is_scanned
        assert restored.page_count == original.page_count
        assert restored.top_keywords == original.top_keywords


class TestFingerprintService:
    """Tests for FingerprintService."""

    def test_extract_keywords_filters_stopwords(self):
        """Test that stopwords are excluded from keywords."""
        service = FingerprintService()

        # Access private method for testing
        items = [
            {"str": "The invoice for the company", "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.02, "page": 1},
            {"str": "Total amount is due", "x": 0.1, "y": 0.2, "width": 0.1, "height": 0.02, "page": 1},
        ]

        keywords = service._extract_keywords(items)

        # 'the', 'for', 'is' should be filtered out
        assert "the" not in keywords
        assert "for" not in keywords
        # 'invoice', 'company', 'due' should be included
        assert "invoice" in keywords or "company" in keywords

    def test_compute_block_signature_creates_grid(self):
        """Test that block signature computation works."""
        service = FingerprintService()

        # Create items clustered in one area
        items = []
        for i in range(10):
            items.append({
                "str": f"Item {i}",
                "x": 0.15,  # All in first column
                "y": 0.15 + i * 0.01,
                "width": 0.1,
                "height": 0.02,
                "page": 1
            })

        blocks = service._compute_block_signature(items)

        # Should detect a dense region
        assert len(blocks) > 0
        # First block should have density >= 5 (our threshold)
        assert blocks[0]["density"] >= 5

    def test_compute_column_signature_detects_columns(self):
        """Test that column detection works for table-like structures."""
        service = FingerprintService()

        # Create items in 3 columns
        items = []
        for i in range(10):
            items.append({"str": f"Col1-{i}", "x": 0.1, "y": 0.1 + i * 0.05, "width": 0.1, "height": 0.02, "page": 1})
            items.append({"str": f"Col2-{i}", "x": 0.5, "y": 0.1 + i * 0.05, "width": 0.1, "height": 0.02, "page": 1})
            items.append({"str": f"Col3-{i}", "x": 0.9, "y": 0.1 + i * 0.05, "width": 0.1, "height": 0.02, "page": 1})

        columns = service._compute_column_signature(items)

        assert len(columns) == 1
        xs = columns[0]["xs_norm"]
        # Should detect 3 column positions (within tolerance)
        assert len(xs) >= 3

    def test_compute_header_footer_hash_consistency(self):
        """Test that header/footer hash is consistent for same input."""
        service = FingerprintService()

        items = [
            {"str": "Company Header", "x": 0.1, "y": 0.05, "width": 0.2, "height": 0.02, "page": 1},  # Header
            {"str": "Body content", "x": 0.1, "y": 0.5, "width": 0.2, "height": 0.02, "page": 1},
            {"str": "Page 1 of 10", "x": 0.1, "y": 0.95, "width": 0.2, "height": 0.02, "page": 1},  # Footer
        ]

        hash1 = service._compute_header_footer_hash(items)
        hash2 = service._compute_header_footer_hash(items)

        assert hash1["header_text_hash"] == hash2["header_text_hash"]
        assert hash1["footer_text_hash"] == hash2["footer_text_hash"]


class TestTemplateMatcher:
    """Tests for TemplateMatcher."""

    def test_find_best_match_returns_none_for_scanned(self):
        """Test that scanned documents are correctly identified."""
        matcher = TemplateMatcher()

        scanned_fp = FingerprintV1(
            is_scanned=True,
            page_count=1,
            top_keywords=[],
            blocks_signature=[],
            column_x_signature=[],
            header_footer_signature={"header_text_hash": "", "footer_text_hash": ""}
        )

        result = matcher.find_best_match(scanned_fp, [])

        assert result["status"] == "SCANNED"
        assert result["template_id"] is None

    def test_find_best_match_matches_similar_fingerprints(self):
        """Test that similar fingerprints result in a match."""
        matcher = TemplateMatcher()

        # Create a document fingerprint
        doc_fp = FingerprintV1(
            is_scanned=False,
            page_count=2,
            top_keywords=["invoice", "vendor", "amount", "balance", "payment"],
            blocks_signature=[{"page": 1, "region_id": 0, "bbox_norm": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.5}, "density": 20}],
            column_x_signature=[{"page": 1, "xs_norm": [0.1, 0.3, 0.5, 0.7, 0.9]}],
            header_footer_signature={"header_text_hash": "abc123", "footer_text_hash": "def456"}
        )

        # Create a similar template fingerprint
        template_fp = {
            "version": "1.0",
            "is_scanned": False,
            "page_count": 2,
            "top_keywords": ["invoice", "vendor", "amount", "total", "due"],  # Overlapping keywords
            "blocks_signature": [{"page": 1, "region_id": 0, "bbox_norm": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.5}, "density": 18}],
            "column_x_signature": [{"page": 1, "xs_norm": [0.1, 0.3, 0.5, 0.7, 0.9]}],  # Same columns
            "header_footer_signature": {"header_text_hash": "abc123", "footer_text_hash": "def456"}  # Same header
        }

        templates = [(1, "Invoice Template", template_fp)]

        result = matcher.find_best_match(doc_fp, templates)

        assert result["template_id"] == 1
        assert result["confidence"] > 50  # Should have reasonable confidence
        assert len(result["reasons"]) > 0

    def test_find_best_match_rejects_dissimilar_fingerprints(self):
        """Test that dissimilar fingerprints don't match."""
        matcher = TemplateMatcher()

        doc_fp = FingerprintV1(
            is_scanned=False,
            page_count=1,
            top_keywords=["receipt", "store", "purchase", "cash", "change"],
            blocks_signature=[],
            column_x_signature=[{"page": 1, "xs_norm": [0.2, 0.8]}],
            header_footer_signature={"header_text_hash": "111", "footer_text_hash": "222"}
        )

        template_fp = {
            "version": "1.0",
            "is_scanned": False,
            "page_count": 10,
            "top_keywords": ["financial", "quarterly", "report", "earnings", "shareholders"],
            "blocks_signature": [],
            "column_x_signature": [{"page": 1, "xs_norm": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]}],
            "header_footer_signature": {"header_text_hash": "999", "footer_text_hash": "888"}
        }

        templates = [(1, "Financial Report", template_fp)]

        result = matcher.find_best_match(doc_fp, templates)

        # Should be unassigned due to low confidence
        assert result["status"] == "UNASSIGNED"

    def test_find_best_match_returns_unassigned_when_no_templates(self):
        """Test that empty template list returns unassigned."""
        matcher = TemplateMatcher()

        doc_fp = FingerprintV1(
            is_scanned=False,
            page_count=1,
            top_keywords=["test"],
            blocks_signature=[],
            column_x_signature=[],
            header_footer_signature={"header_text_hash": "", "footer_text_hash": ""}
        )

        result = matcher.find_best_match(doc_fp, [])

        assert result["status"] == "UNASSIGNED"
        assert "No templates available" in result["reasons"][0]


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_match_document_to_templates_works(self):
        """Test the convenience function for matching."""
        doc_fp_dict = {
            "version": "1.0",
            "is_scanned": False,
            "page_count": 1,
            "top_keywords": ["invoice"],
            "blocks_signature": [],
            "column_x_signature": [],
            "header_footer_signature": {"header_text_hash": "", "footer_text_hash": ""}
        }

        result = match_document_to_templates(doc_fp_dict, [])

        assert "status" in result
        assert "template_id" in result
        assert "confidence" in result
        assert "reasons" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
