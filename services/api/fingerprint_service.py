"""
Document Style Fingerprint Service
Generates a deterministic fingerprint for PDF documents to enable template matching.
"""

import hashlib
import re
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
import fitz  # PyMuPDF


# Stopwords to exclude from keyword extraction
STOPWORDS = {
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'have', 'are',
    'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'get', 'got', 'getting', 'let', 'lets', 'let\'s', 'make',
    'making', 'made', 'see', 'seeing', 'saw', 'seen', 'take', 'taking', 'took',
    'taken', 'come', 'coming', 'came', 'give', 'giving', 'gave', 'given', 'find',
    'finding', 'found', 'tell', 'telling', 'told', 'ask', 'asking', 'asked',
    'use', 'using', 'work', 'working', 'worked', 'seem', 'seeming', 'seemed',
    'try', 'trying', 'tried', 'leave', 'leaving', 'left', 'call', 'calling',
    'called', 'keep', 'keeping', 'kept', 'page', 'date', 'total', 'amount'
}


class FingerprintV1:
    """
    Version 1.0 of the document fingerprint structure.
    """
    def __init__(
        self,
        is_scanned: bool,
        page_count: int,
        top_keywords: List[str],
        blocks_signature: List[Dict[str, Any]],
        column_x_signature: List[Dict[str, Any]],
        header_footer_signature: Dict[str, str]
    ):
        self.version = "1.0"
        self.is_scanned = is_scanned
        self.page_count = page_count
        self.top_keywords = top_keywords
        self.blocks_signature = blocks_signature
        self.column_x_signature = column_x_signature
        self.header_footer_signature = header_footer_signature

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "is_scanned": self.is_scanned,
            "page_count": self.page_count,
            "top_keywords": self.top_keywords,
            "blocks_signature": self.blocks_signature,
            "column_x_signature": self.column_x_signature,
            "header_footer_signature": self.header_footer_signature
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FingerprintV1':
        return cls(
            is_scanned=data.get("is_scanned", False),
            page_count=data.get("page_count", 0),
            top_keywords=data.get("top_keywords", []),
            blocks_signature=data.get("blocks_signature", []),
            column_x_signature=data.get("column_x_signature", []),
            header_footer_signature=data.get("header_footer_signature", {})
        )


class FingerprintService:
    """
    Service to generate document style fingerprints from PDFs.
    """

    def generate(self, pdf_path: str) -> FingerprintV1:
        """
        Generate a fingerprint from a PDF file path.
        """
        doc = fitz.open(pdf_path)
        try:
            return self._generate_from_doc(doc)
        finally:
            doc.close()

    def generate_from_bytes(self, pdf_bytes: bytes) -> FingerprintV1:
        """
        Generate a fingerprint from PDF bytes.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            return self._generate_from_doc(doc)
        finally:
            doc.close()

    def _generate_from_doc(self, doc: fitz.Document) -> FingerprintV1:
        """
        Generate fingerprint from an open fitz document.
        """
        page_count = len(doc)
        limit_pages = min(page_count, 2)  # Analyze first 2 pages

        all_text_items: List[Dict[str, Any]] = []
        total_chars = 0

        for page_num in range(limit_pages):
            page = doc[page_num]
            width = page.rect.width
            height = page.rect.height

            # Extract text blocks with position info
            blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

            for block in blocks:
                if block.get("type") == 0:  # Text block
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            text = span.get("text", "").strip()
                            if not text:
                                continue

                            bbox = span.get("bbox", [0, 0, 0, 0])
                            x0, y0, x1, y1 = bbox

                            # Normalize coordinates to 0-1 range
                            x_norm = x0 / width if width > 0 else 0
                            y_norm = y0 / height if height > 0 else 0
                            w_norm = (x1 - x0) / width if width > 0 else 0
                            h_norm = (y1 - y0) / height if height > 0 else 0

                            total_chars += len(text)

                            all_text_items.append({
                                "page": page_num + 1,
                                "str": text,
                                "x": x_norm,
                                "y": y_norm,
                                "width": w_norm,
                                "height": h_norm
                            })

        # Detect if scanned (very low text content)
        is_scanned = total_chars < 50 * limit_pages

        # Extract top keywords
        top_keywords = self._extract_keywords(all_text_items)

        # Compute block signature
        blocks_signature = self._compute_block_signature(all_text_items)

        # Compute column X signature
        column_x_signature = self._compute_column_signature(all_text_items)

        # Compute header/footer hash
        header_footer_signature = self._compute_header_footer_hash(all_text_items)

        return FingerprintV1(
            is_scanned=is_scanned,
            page_count=page_count,
            top_keywords=top_keywords,
            blocks_signature=blocks_signature,
            column_x_signature=column_x_signature,
            header_footer_signature=header_footer_signature
        )

    def _extract_keywords(self, items: List[Dict[str, Any]]) -> List[str]:
        """
        Extract top 10 keywords from text items, excluding stopwords.
        """
        word_counts: Dict[str, int] = defaultdict(int)

        for item in items:
            text = item.get("str", "").lower()
            # Find words with 3+ characters
            words = re.findall(r'\b[a-z]{3,}\b', text)
            for word in words:
                if word not in STOPWORDS:
                    word_counts[word] += 1

        # Sort by frequency and return top 10
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        return [word for word, _ in sorted_words[:10]]

    def _compute_block_signature(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Compute block density signature using a 10x10 grid.
        """
        # Create 10x10 grid
        grid = [[0 for _ in range(10)] for _ in range(10)]

        for item in items:
            x = item.get("x", 0)
            y = item.get("y", 0)
            gx = min(9, int(x * 10))
            gy = min(9, int(y * 10))
            grid[gy][gx] += 1

        # Find cells with density > threshold
        blocks = []
        for y in range(10):
            for x in range(10):
                if grid[y][x] > 5:  # Density threshold
                    blocks.append({
                        "page": 1,  # Simplified to page 1
                        "region_id": y * 10 + x,
                        "bbox_norm": {
                            "x0": x / 10,
                            "y0": y / 10,
                            "x1": (x + 1) / 10,
                            "y1": (y + 1) / 10
                        },
                        "density": grid[y][x]
                    })

        return blocks

    def _compute_column_signature(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Compute column X positions by projecting text onto X axis.
        """
        x_buckets: Dict[float, int] = defaultdict(int)

        for item in items:
            # Round to nearest 0.05 (5%)
            x = round(item.get("x", 0) * 20) / 20
            x_buckets[x] += 1

        # Find peaks (columns with > 5 items)
        xs_norm = sorted([x for x, count in x_buckets.items() if count > 5])

        return [{
            "page": 1,
            "xs_norm": xs_norm
        }]

    def _compute_header_footer_hash(self, items: List[Dict[str, Any]]) -> Dict[str, str]:
        """
        Compute hash of header (top 10%) and footer (bottom 10%) text.
        """
        header_text = "".join(
            item.get("str", "") for item in items if item.get("y", 1) < 0.1
        )
        footer_text = "".join(
            item.get("str", "") for item in items if item.get("y", 0) > 0.9
        )

        return {
            "header_text_hash": hashlib.md5(header_text.encode()).hexdigest(),
            "footer_text_hash": hashlib.md5(footer_text.encode()).hexdigest()
        }


class TemplateMatcher:
    """
    Service to match document fingerprints against template fingerprints.
    """

    # Scoring weights
    WEIGHTS = {
        "keyword": 0.4,
        "column": 0.3,
        "header": 0.2,
        "blocks": 0.1
    }

    # Confidence thresholds
    THRESHOLD_MATCHED = 0.80
    THRESHOLD_LOW_CONFIDENCE = 0.55

    def find_best_match(
        self,
        doc_fingerprint: FingerprintV1,
        templates: List[Tuple[int, str, Optional[Dict[str, Any]]]]  # (id, name, fingerprint_json)
    ) -> Optional[Dict[str, Any]]:
        """
        Find the best matching template for a document fingerprint.

        Args:
            doc_fingerprint: The document's fingerprint
            templates: List of (template_id, template_name, fingerprint_json) tuples

        Returns:
            Match result with template_id, confidence, reasons, and status
        """
        # If document is scanned, return immediately
        if doc_fingerprint.is_scanned:
            return {
                "template_id": None,
                "template_name": None,
                "confidence": 0,
                "reasons": ["Document appears to be scanned (insufficient text)"],
                "status": "SCANNED"
            }

        best_match = None
        highest_score = 0

        for template_id, template_name, fp_json in templates:
            if not fp_json:
                continue

            template_fp = FingerprintV1.from_dict(fp_json)
            score_result = self._calculate_score(doc_fingerprint, template_fp)

            if score_result["total"] > highest_score:
                highest_score = score_result["total"]
                best_match = {
                    "template_id": template_id,
                    "template_name": template_name,
                    "confidence": round(score_result["total"] * 100),  # Convert to 0-100
                    "reasons": score_result["reasons"]
                }

        if best_match:
            if best_match["confidence"] >= self.THRESHOLD_MATCHED * 100:
                best_match["status"] = "MATCHED"
            elif best_match["confidence"] >= self.THRESHOLD_LOW_CONFIDENCE * 100:
                best_match["status"] = "UNASSIGNED"
                best_match["reasons"].append("Low confidence match - needs review")
            else:
                best_match["status"] = "UNASSIGNED"
                best_match["reasons"].append("No confident match found")
            return best_match

        return {
            "template_id": None,
            "template_name": None,
            "confidence": 0,
            "reasons": ["No templates available for matching"],
            "status": "UNASSIGNED"
        }

    def _calculate_score(
        self,
        doc_fp: FingerprintV1,
        template_fp: FingerprintV1
    ) -> Dict[str, Any]:
        """
        Calculate similarity score between two fingerprints.
        """
        reasons = []

        # 1. Keyword Overlap (Jaccard similarity)
        keywords_a = set(doc_fp.top_keywords)
        keywords_b = set(template_fp.top_keywords)
        intersection = keywords_a & keywords_b
        union = keywords_a | keywords_b
        keyword_score = len(intersection) / len(union) if union else 0

        if keyword_score > 0.5:
            reasons.append(f"Keywords match ({int(keyword_score * 100)}%)")

        # 2. Column Signature (Mean Absolute Error comparison)
        column_score = 0
        if doc_fp.column_x_signature and template_fp.column_x_signature:
            cols_a = doc_fp.column_x_signature[0].get("xs_norm", [])
            cols_b = template_fp.column_x_signature[0].get("xs_norm", [])

            if cols_a and cols_b and abs(len(cols_a) - len(cols_b)) <= 1:
                # Count matching columns within 5% tolerance
                match_count = 0
                for xa in cols_a:
                    if any(abs(xa - xb) < 0.05 for xb in cols_b):
                        match_count += 1
                column_score = match_count / max(len(cols_a), len(cols_b))

        if column_score > 0.8:
            reasons.append("Column layout matches")

        # 3. Header/Footer Hash (Exact match bonus)
        header_score = 0
        doc_header = doc_fp.header_footer_signature.get("header_text_hash", "")
        template_header = template_fp.header_footer_signature.get("header_text_hash", "")
        if doc_header and template_header and doc_header == template_header:
            header_score = 1.0
            reasons.append("Header text matches exactly")

        # 4. Blocks (Simplified density check)
        blocks_score = 0.5  # Placeholder for complex region matching

        # Calculate weighted total
        total = (
            keyword_score * self.WEIGHTS["keyword"] +
            column_score * self.WEIGHTS["column"] +
            header_score * self.WEIGHTS["header"] +
            blocks_score * self.WEIGHTS["blocks"]
        )

        return {"total": total, "reasons": reasons}


# Convenience function
def compute_fingerprint(pdf_path: str) -> Dict[str, Any]:
    """
    Compute fingerprint for a PDF file and return as dict.
    """
    service = FingerprintService()
    fp = service.generate(pdf_path)
    return fp.to_dict()


def match_document_to_templates(
    doc_fingerprint_dict: Dict[str, Any],
    templates: List[Tuple[int, str, Optional[Dict[str, Any]]]]
) -> Dict[str, Any]:
    """
    Match a document fingerprint against templates.
    """
    doc_fp = FingerprintV1.from_dict(doc_fingerprint_dict)
    matcher = TemplateMatcher()
    return matcher.find_best_match(doc_fp, templates)
