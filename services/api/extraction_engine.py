import fitz
import re
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from sklearn.cluster import DBSCAN
from collections import defaultdict
from enum import Enum


class TableMode(Enum):
    """Detected table parsing mode"""
    ASCII_PIPE = "ASCII_PIPE"      # Pipe-delimited text tables (e.g., | col1 | col2 |)
    GRID_LINES = "GRID_LINES"      # PDF vector grid lines
    TEXT_ALIGNMENT = "TEXT_ALIGNMENT"  # Position-based text clustering

@dataclass
class TextSpan:
    text: str
    bbox: Tuple[float, float, float, float]
    page: int
    
    @property
    def x0(self): return self.bbox[0]
    @property
    def y0(self): return self.bbox[1]
    @property
    def x1(self): return self.bbox[2]
    @property
    def y1(self): return self.bbox[3]
    @property
    def x_center(self): return (self.x0 + self.x1) / 2
    @property
    def y_center(self): return (self.y0 + self.y1) / 2

class PDFExtractor:
    def __init__(self, pdf_path: str):
        self.doc = fitz.open(pdf_path)
        self.page_count = len(self.doc)
    
    def close(self):
        self.doc.close()
    
    def is_digital_pdf(self) -> bool:
        for page_num in range(min(3, self.page_count)):
            page = self.doc[page_num]
            text = page.get_text()
            if len(text.strip()) > 100:
                return True
        return False
    
    def find_anchor(self, page: fitz.Page, anchor_config: Dict[str, Any]) -> Optional[Tuple[float, float, float, float]]:
        text = anchor_config.get("text", "")
        match_mode = anchor_config.get("matchMode", "contains")
        tolerance = anchor_config.get("tolerancePx", 10)
        
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if block.get("type") == 0:
                for line in block.get("lines", []):
                    line_text = ""
                    for span in line.get("spans", []):
                        line_text += span.get("text", "")
                    
                    matched = False
                    if match_mode == "exact":
                        matched = line_text.strip() == text
                    elif match_mode == "contains":
                        matched = text in line_text
                    elif match_mode == "regex":
                        matched = re.search(text, line_text) is not None
                    
                    if matched:
                        return block["bbox"]
        
        return None
    
    def extract_text_spans(self, page: fitz.Page, bbox: Tuple[float, float, float, float], page_num: int) -> List[TextSpan]:
        x0, y0, x1, y1 = bbox
        spans = []
        
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if block.get("type") == 0:
                bx0, by0, bx1, by1 = block["bbox"]
                
                if not (bx1 < x0 or bx0 > x1 or by1 < y0 or by0 > y1):
                    for line in block.get("lines", []):
                        for span in line.get("spans", []):
                            span_bbox = span["bbox"]
                            sx0, sy0, sx1, sy1 = span_bbox
                            
                            if not (sx1 < x0 or sx0 > x1 or sy1 < y0 or sy0 > y1):
                                text = span.get("text", "").strip()
                                if text:
                                    spans.append(TextSpan(text, span_bbox, page_num))
        
        return spans
    
    def cluster_columns(self, spans: List[TextSpan], guides: Optional[List[float]] = None,
                         column_boundaries: Optional[List[float]] = None, tolerance: float = 10) -> Dict[int, List[TextSpan]]:
        """
        Cluster text spans into columns.

        Args:
            spans: List of text spans to cluster
            guides: Column separator x positions (n separators create n+1 columns)
            column_boundaries: Full column boundaries including edges (n+1 boundaries for n columns)
            tolerance: Clustering tolerance for DBSCAN fallback

        Returns:
            Dict mapping column index to list of spans in that column
        """
        # Priority 1: Use column_boundaries (interval-based assignment)
        if column_boundaries and len(column_boundaries) >= 2:
            columns = defaultdict(list)
            for span in spans:
                x_center = span.x_center
                # Find which interval the span falls into
                assigned = False
                for i in range(len(column_boundaries) - 1):
                    left = column_boundaries[i]
                    right = column_boundaries[i + 1]
                    if left <= x_center < right:
                        columns[i].append(span)
                        assigned = True
                        break
                # If not assigned (edge case), put in last column
                if not assigned:
                    columns[len(column_boundaries) - 2].append(span)
            return dict(columns)

        # Priority 2: Use guides (separator-based assignment - legacy behavior)
        if guides:
            columns = defaultdict(list)
            for span in spans:
                x_center = span.x_center
                col_idx = 0
                for i, guide in enumerate(guides):
                    if x_center >= guide:
                        col_idx = i + 1
                columns[col_idx].append(span)
            return dict(columns)

        # Priority 3: DBSCAN clustering fallback
        if not spans:
            return {}

        x_positions = np.array([[span.x_center] for span in spans])
        clustering = DBSCAN(eps=tolerance, min_samples=1).fit(x_positions)

        columns = defaultdict(list)
        for span, label in zip(spans, clustering.labels_):
            columns[label].append(span)

        sorted_columns = sorted(columns.items(), key=lambda x: min(s.x_center for s in x[1]))
        return {i: col_spans for i, (_, col_spans) in enumerate(sorted_columns)}
    
    def cluster_rows(self, spans: List[TextSpan], tolerance: float = 5) -> Dict[int, List[TextSpan]]:
        if not spans:
            return {}
        
        y_positions = np.array([[span.y_center] for span in spans])
        clustering = DBSCAN(eps=tolerance, min_samples=1).fit(y_positions)
        
        rows = defaultdict(list)
        for span, label in zip(spans, clustering.labels_):
            rows[label].append(span)
        
        sorted_rows = sorted(rows.items(), key=lambda x: min(s.y_center for s in x[1]))
        return {i: row_spans for i, (_, row_spans) in enumerate(sorted_rows)}
    
    def build_grid(self, spans: List[TextSpan], column_guides: Optional[List[float]] = None,
                   column_boundaries: Optional[List[float]] = None) -> List[List[str]]:
        """
        Build a grid (2D array) from text spans.

        Args:
            spans: List of text spans extracted from PDF
            column_guides: Column separator x positions (n separators for n+1 columns)
            column_boundaries: Full column boundary x positions (n+1 boundaries for n columns)
                               Takes priority over column_guides if provided

        Returns:
            2D list of strings representing the table
        """
        columns = self.cluster_columns(spans, column_guides, column_boundaries)

        if not columns:
            return []

        all_spans_flat = []
        for col_idx, col_spans in columns.items():
            for span in col_spans:
                all_spans_flat.append((span, col_idx))

        rows_dict = defaultdict(lambda: defaultdict(list))
        for span, col_idx in all_spans_flat:
            y_key = round(span.y_center / 5) * 5
            rows_dict[y_key][col_idx].append(span.text)

        sorted_row_keys = sorted(rows_dict.keys())

        # Determine number of columns from boundaries or detected columns
        if column_boundaries:
            num_cols = len(column_boundaries) - 1
        else:
            num_cols = max(columns.keys()) + 1 if columns else 0

        grid = []

        for y_key in sorted_row_keys:
            row_data = rows_dict[y_key]
            row = []
            for col_idx in range(num_cols):
                cell_texts = row_data.get(col_idx, [])
                cell_value = " ".join(cell_texts).strip()
                row.append(cell_value)
            grid.append(row)

        return grid
    
    def detect_scanned_pdf(self) -> bool:
        return not self.is_digital_pdf()

    def detect_header_row(self, grid: List[List[str]], max_rows: int = 30) -> Dict[str, Any]:
        """
        Automatically detect which row is the header row in a table grid.

        Strategy: Find the EARLIEST row that meets header criteria.
        Hard-block title/metadata rows (cannot be header).
        Require at least one header keyword for high confidence.

        Returns:
            {
                "headerIndex": int,        # 0-based index of header row
                "headerSpan": int,         # 1 or 2 (if header spans multiple lines)
                "confidence": float,       # 0-1 confidence score
                "reason": str,             # Human readable explanation
                "candidates": List[Dict],  # Top candidate rows with scores
            }
        """
        if not grid or len(grid) == 0:
            return {
                "headerIndex": 0,
                "headerSpan": 1,
                "confidence": 0,
                "reason": "No data to analyze",
                "candidates": []
            }

        # Keywords that suggest a header row (column names)
        HEADER_KEYWORDS = [
            "ACCOUNT", "HEAD", "TOTAL", "DEBIT", "CREDIT", "BALANCE",
            "AMOUNT", "QTY", "DATE", "CUMULATIVE", "PREV", "NAME",
            "DESCRIPTION", "PARTICULARS", "CODE", "NO", "SR", "VOUCHER",
            "OPENING", "CLOSING", "NET", "GROSS", "TAX", "RATE", "UNIT",
            "BUDGET", "EXPENDITURE", "RECEIPT", "PAYMENT", "D.A.T", "T.O",
            "UPTO", "DURING", "PROGRESSIVE", "COLUMN", "SERIAL"
        ]

        # HARD NEGATIVE: Title/metadata rows - these can NEVER be headers
        TITLE_KEYWORDS = [
            "GOVERNMENT", "DIRECTORATE", "CONSOLIDATION", "MONTH",
            "STATE", "PAGE", "REPORTING", "MINISTRY", "DEPARTMENT",
            "FISCAL", "PERIOD", "STATEMENT", "REPORT", "TREASURY",
            "UNION", "TERRITORY", "DISTRICT", "DIVISION", "OFFICE"
        ]

        # Numeric patterns
        NUMERIC_PATTERN = re.compile(r'^[\s]*[-+]?[\d,.\s]+[\s]*$')
        SEPARATOR_PATTERN = re.compile(r'^[\s\-=_|\.]+$')

        num_cols = len(grid[0]) if grid else 0
        candidates = []

        # Analyze first N rows
        rows_to_check = min(len(grid), max_rows)

        for i in range(rows_to_check):
            row = grid[i]

            # Count cell characteristics
            non_empty_count = 0
            numeric_count = 0
            header_keyword_count = 0
            title_keyword_count = 0
            separator_chars = 0
            total_chars = 0

            for cell in row:
                cell_text = (cell or "").strip()
                if cell_text:
                    non_empty_count += 1
                    total_chars += len(cell_text)

                    # Check if numeric
                    if NUMERIC_PATTERN.match(cell_text):
                        numeric_count += 1

                    # Check for separator pattern
                    if SEPARATOR_PATTERN.match(cell_text):
                        separator_chars += len(cell_text)

                    # Check for header keywords
                    cell_upper = cell_text.upper()
                    for kw in HEADER_KEYWORDS:
                        if kw in cell_upper:
                            header_keyword_count += 1
                            break

                    # Check for title keywords (HARD BLOCK)
                    for kw in TITLE_KEYWORDS:
                        if kw in cell_upper:
                            title_keyword_count += 1
                            break

            # Calculate metrics
            coverage = non_empty_count / num_cols if num_cols > 0 else 0
            text_ratio = 1 - (numeric_count / non_empty_count) if non_empty_count > 0 else 0
            separator_ratio = separator_chars / total_chars if total_chars > 0 else 0
            is_separator = separator_ratio > 0.5
            is_title_row = title_keyword_count > 0  # HARD BLOCK

            # Calculate score (for ranking, but we pick earliest qualifying row)
            score = 0
            reasons = []

            # Coverage boost (header should have most columns filled)
            score += coverage * 2.0
            if coverage >= 0.6:
                reasons.append(f"good coverage ({coverage:.0%})")

            # Text ratio boost (header should be mostly text, not numbers)
            score += text_ratio * 2.0
            if text_ratio >= 0.6:
                reasons.append(f"text-heavy ({text_ratio:.0%})")

            # Header keyword boost
            if header_keyword_count > 0:
                score += min(header_keyword_count * 0.5, 1.5)
                reasons.append(f"{header_keyword_count} header keyword(s)")

            # Title row - mark but don't include in score (hard blocked)
            if is_title_row:
                reasons.append("title/metadata row (blocked)")

            # Separator penalty
            if is_separator:
                reasons.append("separator row")

            # Row preview - show more cells for better UI
            preview_cells = [c for c in row if (c or "").strip()][:5]
            preview = " | ".join(preview_cells)
            if len(preview) > 80:
                preview = preview[:77] + "..."

            # Determine if this row qualifies as a header
            # Requirements: coverage >= 0.6, textRatio >= 0.6, has header keyword, NOT title row
            qualifies_as_header = (
                coverage >= 0.5 and
                text_ratio >= 0.5 and
                header_keyword_count >= 1 and
                not is_title_row and
                not is_separator
            )

            candidates.append({
                "index": i,
                "score": score,
                "coverage": coverage,
                "textRatio": text_ratio,
                "headerKeywords": header_keyword_count,
                "titleKeywords": title_keyword_count,
                "isSeparator": is_separator,
                "isTitleRow": is_title_row,
                "qualifies": qualifies_as_header,
                "preview": preview,
                "reasons": reasons
            })

        # STRATEGY: Pick the EARLIEST row that qualifies as header
        # This prevents picking row 7 when row 2 is the real header
        best = None

        # First pass: Find earliest qualifying header (with header keywords)
        for cand in candidates:
            if cand["qualifies"]:
                best = cand
                break

        # Second pass: Relax requirement - earliest non-title, non-separator, text-heavy row
        if best is None:
            for cand in candidates:
                if (not cand["isTitleRow"] and
                    not cand["isSeparator"] and
                    cand["textRatio"] >= 0.5 and
                    cand["coverage"] >= 0.3):
                    best = cand
                    break

        # Third pass: Just find earliest non-blocked row
        if best is None:
            for cand in candidates:
                if not cand["isTitleRow"] and not cand["isSeparator"]:
                    best = cand
                    break

        # Last resort: use first row
        if best is None:
            best = candidates[0] if candidates else {"index": 0, "score": 0, "reasons": ["default"], "qualifies": False}

        # Safety check: Never return headerIndex > 5 unless it actually qualifies
        if best["index"] > 5 and not best.get("qualifies", False):
            # Search for a better candidate in first 5 rows
            for cand in candidates[:6]:
                if not cand["isTitleRow"] and not cand["isSeparator"]:
                    best = cand
                    break

        # Check if header spans 2 rows
        header_span = 1
        best_idx = best["index"]
        if best_idx + 1 < len(candidates):
            next_row_cand = candidates[best_idx + 1] if best_idx + 1 < len(candidates) else None
            if next_row_cand:
                # If next row is also text-heavy but low coverage, might be continuation
                if (next_row_cand["textRatio"] >= 0.7 and
                    next_row_cand["coverage"] < 0.4 and
                    not next_row_cand["isTitleRow"] and
                    not next_row_cand["isSeparator"]):
                    header_span = 2

        # Calculate confidence based on how well it qualifies
        if best.get("qualifies", False):
            # High confidence if it has header keywords and good metrics
            confidence = min(1.0, 0.6 + best.get("headerKeywords", 0) * 0.1 + best.get("coverage", 0) * 0.2)
        else:
            # Lower confidence for fallback selection
            confidence = max(0.2, min(0.5, best.get("score", 0) / 4.0))

        # Sort candidates for UI display (by row index, not score)
        display_candidates = sorted(candidates[:15], key=lambda x: x["index"])

        return {
            "headerIndex": best["index"],
            "headerSpan": header_span,
            "confidence": round(confidence, 2),
            "reason": ", ".join(best.get("reasons", ["unknown"])),
            "candidates": display_candidates
        }

    def extract_raw_text_lines(self, page: fitz.Page, bbox: Tuple[float, float, float, float]) -> List[str]:
        """
        Extract raw text from a region, preserving line breaks.
        Returns a list of text lines.
        """
        x0, y0, x1, y1 = bbox
        clip_rect = fitz.Rect(x0, y0, x1, y1)

        # Get text with preserved line breaks
        text = page.get_text("text", clip=clip_rect)
        lines = text.split('\n')

        # Filter empty lines but preserve structure
        return [line for line in lines]

    def detect_table_mode(self, lines: List[str], grid_info: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Detect the best parsing mode for a table.

        Returns:
            {
                "mode": TableMode,
                "confidence": float,
                "pipeDensity": float,
                "separatorLineRate": float,
                "gridDetected": bool,
                "reason": str
            }
        """
        if not lines:
            return {
                "mode": TableMode.TEXT_ALIGNMENT.value,
                "confidence": 0.3,
                "pipeDensity": 0,
                "separatorLineRate": 0,
                "gridDetected": False,
                "reason": "No text to analyze"
            }

        # Count pipe characters and separators
        total_chars = 0
        pipe_count = 0
        separator_lines = 0
        non_empty_lines = 0

        # Regex for separator lines (mostly dashes, pipes, equals, underscores, plus signs)
        SEPARATOR_LINE_PATTERN = re.compile(r'^[\s\-\|=_\+\.]{10,}$')

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            non_empty_lines += 1
            total_chars += len(stripped)
            pipe_count += stripped.count('|')

            # Check if line is a separator
            if SEPARATOR_LINE_PATTERN.match(stripped):
                separator_lines += 1

        # Calculate metrics
        pipe_density = pipe_count / total_chars if total_chars > 0 else 0
        separator_rate = separator_lines / non_empty_lines if non_empty_lines > 0 else 0

        # Check grid detection results
        grid_detected = False
        grid_column_count = 0
        if grid_info:
            grid_detected = grid_info.get("has_grid", False) or grid_info.get("columns_detected", 0) >= 6
            grid_column_count = grid_info.get("columns_detected", 0)

        # Decision logic
        mode = TableMode.TEXT_ALIGNMENT
        confidence = 0.5
        reason = "Default text alignment mode"

        # ASCII_PIPE mode: High pipe density OR many separator lines with pipes
        if pipe_density > 0.02:  # More than 2% of chars are pipes
            mode = TableMode.ASCII_PIPE
            confidence = min(0.9, 0.5 + pipe_density * 10)
            reason = f"High pipe density ({pipe_density:.1%})"
        elif separator_rate > 0.1 and pipe_count > 5:  # >10% separator lines with pipes present
            mode = TableMode.ASCII_PIPE
            confidence = 0.7
            reason = f"Separator lines with pipes ({separator_rate:.0%} separators, {pipe_count} pipes)"
        # GRID_LINES mode: Strong grid detection
        elif grid_detected and grid_column_count >= 8:
            mode = TableMode.GRID_LINES
            confidence = 0.8
            reason = f"Strong grid detection ({grid_column_count} columns)"
        elif grid_detected:
            mode = TableMode.GRID_LINES
            confidence = 0.6
            reason = f"Grid lines detected ({grid_column_count} columns)"

        return {
            "mode": mode.value,
            "confidence": round(confidence, 2),
            "pipeDensity": round(pipe_density, 4),
            "separatorLineRate": round(separator_rate, 2),
            "gridDetected": grid_detected,
            "gridColumnCount": grid_column_count,
            "reason": reason
        }

    def parse_ascii_pipe_table(self, lines: List[str]) -> Dict[str, Any]:
        """
        Parse a pipe-delimited ASCII table.

        Input: lines of text (preserving newlines)
        Output: {
            "grid": List[List[str]],  # Parsed table data
            "headerIndex": int,       # Detected header row
            "separatorRows": List[int],  # Indices of removed separator rows
            "columnCount": int,
            "diagnostics": Dict
        }
        """
        if not lines:
            return {
                "grid": [],
                "headerIndex": 0,
                "separatorRows": [],
                "columnCount": 0,
                "diagnostics": {"error": "No input lines"}
            }

        # Separator line patterns
        SEPARATOR_PATTERN = re.compile(r'^[\s\-\|=_\+\.]{10,}$')
        LOW_ALPHA_THRESHOLD = 0.1  # Less than 10% alphanumeric = separator

        parsed_rows = []
        separator_indices = []
        original_indices = []

        for i, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue

            # Check if separator line
            is_separator = False
            if SEPARATOR_PATTERN.match(stripped):
                is_separator = True
            else:
                # Check alphanumeric ratio
                alnum_count = sum(1 for c in stripped if c.isalnum())
                if len(stripped) > 5 and alnum_count / len(stripped) < LOW_ALPHA_THRESHOLD:
                    is_separator = True

            if is_separator:
                separator_indices.append(i)
                continue

            # Split by pipe, keeping empty cells
            # Handle both "| cell | cell |" and "cell | cell" formats
            if '|' in stripped:
                # Remove leading/trailing pipes before split
                cleaned = stripped
                if cleaned.startswith('|'):
                    cleaned = cleaned[1:]
                if cleaned.endswith('|'):
                    cleaned = cleaned[:-1]

                cells = [c.strip() for c in cleaned.split('|')]
            else:
                # No pipes - treat as single cell or try whitespace split
                cells = [stripped]

            parsed_rows.append(cells)
            original_indices.append(i)

        if not parsed_rows:
            return {
                "grid": [],
                "headerIndex": 0,
                "separatorRows": separator_indices,
                "columnCount": 0,
                "diagnostics": {"error": "No data rows found"}
            }

        # Determine column count from the most common split count
        split_counts = [len(row) for row in parsed_rows]
        from collections import Counter
        count_freq = Counter(split_counts)
        most_common_count = count_freq.most_common(1)[0][0]

        # Also consider header row (often first non-separator row)
        header_count = len(parsed_rows[0]) if parsed_rows else most_common_count

        # Use the larger of header count or most common (finance tables often have consistent columns)
        column_count = max(header_count, most_common_count)

        # Normalize rows to column_count
        normalized_grid = []
        for row in parsed_rows:
            if len(row) < column_count:
                # Pad with empty cells
                row = row + [''] * (column_count - len(row))
            elif len(row) > column_count:
                # Merge overflow into last cell (likely text wrap)
                overflow = ' '.join(row[column_count-1:])
                row = row[:column_count-1] + [overflow]
            normalized_grid.append(row)

        # Detect header row using the specialized method for pipe tables
        header_index = self._detect_pipe_table_header(normalized_grid)

        return {
            "grid": normalized_grid,
            "headerIndex": header_index,
            "separatorRows": separator_indices,
            "columnCount": column_count,
            "diagnostics": {
                "totalLines": len(lines),
                "separatorCount": len(separator_indices),
                "dataRowCount": len(normalized_grid),
                "splitCounts": dict(count_freq.most_common(5))
            }
        }

    def _detect_pipe_table_header(self, grid: List[List[str]]) -> int:
        """
        Detect header row in a pipe-parsed table.
        Returns the 0-based index of the best header row.
        """
        if not grid:
            return 0

        HEADER_KEYWORDS = [
            "ACCOUNT", "HEAD", "TOTAL", "DEBIT", "CREDIT", "BALANCE",
            "AMOUNT", "QTY", "DATE", "CUMULATIVE", "PREV", "NAME",
            "DESCRIPTION", "PARTICULARS", "CODE", "NO", "SR", "VOUCHER",
            "OPENING", "CLOSING", "NET", "GROSS", "TAX", "RATE", "UNIT",
            "BUDGET", "EXPENDITURE", "RECEIPT", "PAYMENT", "D.A.T", "T.O",
            "UPTO", "DURING", "PROGRESSIVE"
        ]

        NUMERIC_PATTERN = re.compile(r'^[\s]*[-+]?[\d,.\s]+[\s]*$')

        best_idx = 0
        best_score = -1

        # Only check first 10 rows
        for i, row in enumerate(grid[:10]):
            score = 0
            keyword_count = 0
            numeric_count = 0
            non_empty = 0

            for cell in row:
                text = (cell or "").strip()
                if not text:
                    continue

                non_empty += 1
                text_upper = text.upper()

                # Check for header keywords
                for kw in HEADER_KEYWORDS:
                    if kw in text_upper:
                        keyword_count += 1
                        break

                # Check if numeric
                if NUMERIC_PATTERN.match(text):
                    numeric_count += 1

            if non_empty == 0:
                continue

            # Score: prefer rows with keywords and low numeric ratio
            text_ratio = 1 - (numeric_count / non_empty)
            score = keyword_count * 2 + text_ratio * 3

            # Bonus for being in first few rows (headers are usually at top)
            if i < 3:
                score += 1

            if score > best_score:
                best_score = score
                best_idx = i

        return best_idx

    def extract_with_mode(self, page: fitz.Page, bbox: Tuple[float, float, float, float],
                          page_num: int, column_guides: Optional[List[float]] = None,
                          column_boundaries: Optional[List[float]] = None,
                          grid_info: Optional[Dict] = None,
                          force_mode: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract table data using automatic mode detection or forced mode.

        Args:
            page: PyMuPDF page object
            bbox: Bounding box tuple (x0, y0, x1, y1)
            page_num: Page number
            column_guides: Manual column separator positions
            column_boundaries: Full column boundaries
            grid_info: Grid detection results
            force_mode: Force a specific mode ("ASCII_PIPE", "GRID_LINES", "TEXT_ALIGNMENT")

        Returns:
            {
                "grid": List[List[str]],
                "mode": str,
                "modeDetection": Dict,
                "headerDetection": Dict,
                "totalRows": int,
                "totalCols": int,
                "diagnostics": Dict
            }
        """
        # Extract raw text lines for mode detection
        raw_lines = self.extract_raw_text_lines(page, bbox)

        # Detect mode
        mode_detection = self.detect_table_mode(raw_lines, grid_info)

        # Override with force_mode if specified
        if force_mode:
            mode_detection["mode"] = force_mode
            mode_detection["reason"] = f"Forced mode: {force_mode}"

        mode = mode_detection["mode"]

        # Extract based on mode
        if mode == TableMode.ASCII_PIPE.value:
            # Use ASCII pipe parser
            pipe_result = self.parse_ascii_pipe_table(raw_lines)
            grid = pipe_result["grid"]
            header_detection = self.detect_header_row(grid)
            # Override with pipe-specific header detection
            header_detection["headerIndex"] = pipe_result["headerIndex"]

            return {
                "grid": grid,
                "mode": mode,
                "modeDetection": mode_detection,
                "headerDetection": header_detection,
                "totalRows": len(grid),
                "totalCols": pipe_result["columnCount"],
                "separatorRows": pipe_result["separatorRows"],
                "diagnostics": pipe_result["diagnostics"]
            }
        else:
            # Use text span extraction (GRID_LINES or TEXT_ALIGNMENT)
            spans = self.extract_text_spans(page, bbox, page_num)
            grid = self.build_grid(spans, column_guides, column_boundaries)
            header_detection = self.detect_header_row(grid)

            return {
                "grid": grid,
                "mode": mode,
                "modeDetection": mode_detection,
                "headerDetection": header_detection,
                "totalRows": len(grid),
                "totalCols": len(grid[0]) if grid else 0,
                "diagnostics": {
                    "spanCount": len(spans),
                    "hasColumnBoundaries": column_boundaries is not None and len(column_boundaries) > 0,
                    "hasColumnGuides": column_guides is not None and len(column_guides) > 0
                }
            }
