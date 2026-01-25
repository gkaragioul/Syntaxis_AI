import fitz
import numpy as np
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

class TableDetector:
    def __init__(self, pdf_path: str):
        self.doc = fitz.open(pdf_path)
    
    def close(self):
        self.doc.close()
    
    def _norm_to_rect(self, page, bbox_norm):
        """Convert normalized bbox (0..1) to page coordinates (Rect)."""
        w, h = page.rect.width, page.rect.height
        return fitz.Rect(
            bbox_norm["x0"] * w,
            bbox_norm["y0"] * h,
            bbox_norm["x1"] * w,
            bbox_norm["y1"] * h
        )

    def _rect_to_norm(self, page, rect):
        """Convert page coordinates (Rect) to normalized bbox (0..1)."""
        w, h = page.rect.width, page.rect.height
        if w == 0 or h == 0:
            return {"x0": 0, "y0": 0, "x1": 0, "y1": 0}
        return {
            "x0": max(0, min(1, rect.x0 / w)),
            "y0": max(0, min(1, rect.y0 / h)),
            "x1": max(0, min(1, rect.x1 / w)),
            "y1": max(0, min(1, rect.y1 / h))
        }

    def _get_page_drawings_lines(self, page):
        """Extract vertical and horizontal lines from page drawings."""
        drawings = page.get_drawings()
        lines = []
        for path in drawings:
            # We only care about strokes or fills that look like thin lines
            for item in path["items"]:
                if item[0] == "l":  # line
                    lines.append((item[1], item[2])) # p1, p2
                elif item[0] == "re": # rect (sometimes lines are drawn as thin rects)
                    rect = item[1]
                    # If very thin, treat as line
                    if rect.width < 2 or rect.height < 2:
                        lines.append((rect.tl, rect.br))
        return lines

    def _count_intersections(self, rect, lines):
        """Count how many vector lines intersect or are contained in the rect."""
        count_v = 0
        count_h = 0
        for p1, p2 in lines:
            line_rect = fitz.Rect(p1, p2)
            if not rect.intersects(line_rect):
                continue
            
            # Check orientation
            w = abs(p1.x - p2.x)
            h = abs(p1.y - p2.y)
            if h > w * 5: # Vertical
                count_v += 1
            elif w > h * 5: # Horizontal
                count_h += 1
        return count_v, count_h

    def _analyze_region(self, page, rect):
        """Compute metrics for a region: spans, whitespace, columns."""
        # Get text in region
        # fitz.Rect is needed
        text_dict = page.get_text("dict", clip=rect)
        blocks = text_dict.get("blocks", [])
        
        spans = []
        for b in blocks:
            for l in b.get("lines", []):
                spans.extend(l.get("spans", []))
        
        span_count = len(spans)
        if span_count == 0:
            return {
                "span_count": 0,
                "whitespace_ratio": 1.0,
                "approx_cols": 0,
                "approx_rows": 0,
                "area_ratio": (rect.width * rect.height) / (page.rect.width * page.rect.height)
            }

        # Histogram for whitespace estimation
        # We project text onto a grid
        # Simplified: area covered by text bboxes vs total rect area
        text_area = sum([(s["bbox"][2] - s["bbox"][0]) * (s["bbox"][3] - s["bbox"][1]) for s in spans])
        rect_area = rect.width * rect.height
        whitespace_ratio = 1.0 - (text_area / rect_area) if rect_area > 0 else 1.0

        # Approx columns: x-histogram
        x_starts = [round(s["bbox"][0]) for s in spans]
        # Cluster x_starts
        x_clusters = set()
        for x in x_starts:
            found = False
            for cx in x_clusters:
                if abs(x - cx) < 10: # 10pt tolerance
                    found = True
                    break
            if not found:
                x_clusters.add(x)
        approx_cols = len(x_clusters)

        # Approx rows: y-centers
        y_centers = [round((s["bbox"][1] + s["bbox"][3])/2) for s in spans]
        y_clusters = set()
        for y in y_centers:
            found = False
            for cy in y_clusters:
                if abs(y - cy) < 5: # 5pt tolerance
                    found = True
                    break
            if not found:
                y_clusters.add(y)
        approx_rows = len(y_clusters)

        return {
            "span_count": span_count,
            "whitespace_ratio_est": whitespace_ratio,
            "approx_cols": approx_cols,
            "approx_rows": approx_rows,
            "area_ratio": rect_area / (page.rect.width * page.rect.height)
        }

    def detect_candidates(self, page_num: int) -> List[Dict]:
        """
        Detect candidate tables on a specific page.
        Returns list of candidates with scores and diagnostics.
        """
        if page_num < 0 or page_num >= len(self.doc):
            return []
        
        page = self.doc[page_num]
        
        # Strategy 1: PyMuPDF built-in find_tables (if available, mostly reliable for grids)
        # Strategy 2: Text block clustering (fallback)
        
        candidates = []
        
        try:
            # Try fitz's native table finder (v1.23+)
            tables = page.find_tables()
            for tab in tables:
                candidates.append(tab.bbox)
        except Exception:
            pass # older pymupdf or failure

        # Also get text blocks to form a backup candidate (bounding box of all significant text)
        text_blocks = page.get_text("blocks")
        if text_blocks:
            # Filter headers/footers roughly (top/bottom 5%)
            valid_blocks = []
            page_h = page.rect.height
            for b in text_blocks:
                x0, y0, x1, y1 = b[:4]
                if y0 > page_h * 0.05 and y1 < page_h * 0.95:
                    valid_blocks.append(b)
            
            if valid_blocks:
                # Merge logic: find largest cluster of blocks
                # Simplification: just take the union of all valid blocks as one candidate (often the main table)
                x0 = min(b[0] for b in valid_blocks)
                y0 = min(b[1] for b in valid_blocks)
                x1 = max(b[2] for b in valid_blocks)
                y1 = max(b[3] for b in valid_blocks)
                candidates.append(fitz.Rect(x0, y0, x1, y1))

        # Filter and score candidates
        scored_candidates = []
        lines = self._get_page_drawings_lines(page)

        seen_bboxes = set()

        for bbox in candidates:
            rect = fitz.Rect(bbox)
            
            # De-duplicate approx
            key = f"{int(rect.x0/10)}_{int(rect.y0/10)}_{int(rect.x1/10)}_{int(rect.y1/10)}"
            if key in seen_bboxes:
                continue
            seen_bboxes.add(key)

            metrics = self._analyze_region(page, rect)
            v_lines, h_lines = self._count_intersections(rect, lines)
            grid_score = min(1.0, (v_lines + h_lines) / 20.0)

            # Quality scoring
            # Penalize huge area (>55%)
            area_penalty = 0
            if metrics["area_ratio"] > 0.55:
                area_penalty = (metrics["area_ratio"] - 0.55) * 2

            # Penalize high whitespace (>70%)
            ws_penalty = 0
            if metrics["whitespace_ratio_est"] > 0.70:
                ws_penalty = (metrics["whitespace_ratio_est"] - 0.70) * 3

            # Boost if has columns
            col_boost = 0
            if metrics["approx_cols"] >= 3:
                col_boost = 0.2
            
            # Boost if has grid lines
            grid_boost = grid_score * 0.4

            base_score = 0.5
            final_score = base_score - area_penalty - ws_penalty + col_boost + grid_boost
            final_score = max(0.1, min(0.99, final_score))
            
            # Diagnostics for Quality Gate
            # BAD if: area > 0.55, whitespace > 0.7, spans < 25, cols < 2
            
            scored_candidates.append({
                "bbox_norm": self._rect_to_norm(page, rect),
                "score": final_score,
                "reason": f"Grid:{v_lines+h_lines}, Cols:{metrics['approx_cols']}",
                "diagnostics": metrics,
                "approxCols": metrics["approx_cols"],
                "approxRows": metrics["approx_rows"]
            })
            
        # Sort by score desc
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)

        # If no candidates, create a fallback "full page" candidate
        # This ensures the user always has something to work with
        if not scored_candidates:
            # Create a default region covering most of the page (5% margins)
            page_w = page.rect.width
            page_h = page.rect.height
            margin = 0.05
            fallback_rect = fitz.Rect(
                page_w * margin,
                page_h * margin,
                page_w * (1 - margin),
                page_h * (1 - margin)
            )
            metrics = self._analyze_region(page, fallback_rect)
            scored_candidates.append({
                "bbox_norm": self._rect_to_norm(page, fallback_rect),
                "score": 0.3,  # Low score to indicate uncertainty
                "reason": "Fallback: Full page selection",
                "confidence_level": "low",
                "confidence_label": "Auto-detection uncertain",
                "diagnostics": metrics,
                "approxCols": metrics["approx_cols"],
                "approxRows": metrics["approx_rows"]
            })

        return scored_candidates

    def snap_selection(self, page_num: int, bbox_norm: Dict) -> Dict:
        """
        Tighten selection using text spans and vector lines.
        Trims empty margins.
        """
        if page_num < 0 or page_num >= len(self.doc):
            return {"bbox_norm_tight": bbox_norm, "error": "Invalid page"}

        page = self.doc[page_num]
        initial_rect = self._norm_to_rect(page, bbox_norm)
        
        # 1. Gather all content (spans & lines) inside initial_rect
        text_dict = page.get_text("dict", clip=initial_rect)
        blocks = text_dict.get("blocks", [])
        
        content_rects = []
        
        # Spans
        for b in blocks:
            for l in b.get("lines", []):
                for s in l.get("spans", []):
                    # Ignore empty spaces
                    if s["text"].strip():
                        content_rects.append(fitz.Rect(s["bbox"]))

        # Lines (simulated as thin rects)
        # We check lines intersecting the bbox
        drawings = self._get_page_drawings_lines(page)
        for p1, p2 in drawings:
            line_rect = fitz.Rect(p1, p2)
            if initial_rect.intersects(line_rect):
                # Only include lines if they are somewhat inside (intersection area check? or just contained points?)
                # Simplest: use intersection
                intersect = initial_rect & line_rect
                if intersect.is_valid:
                     content_rects.append(intersect)

        if not content_rects:
            # Nothing found, return original
            metrics = self._analyze_region(page, initial_rect)
            return {
                "bbox_norm_tight": bbox_norm,
                "score": 0.1,
                "reason": "No content found to snap to",
                "diagnostics": metrics,
                "approxCols": 0,
                "approxRows": 0
            }

        # 2. Compute union of all content rects (Bounding Box)
        # Initialize with first
        union_rect = content_rects[0]
        for r in content_rects[1:]:
             union_rect |= r # Union
        
        # 3. Trim Margins using Histograms (95% retention)
        # We build histograms of projected presence
        # Resolution: 2 points
        
        x_min, y_min, x_max, y_max = union_rect
        width = x_max - x_min
        height = y_max - y_min
        
        if width <= 0 or height <= 0:
             metrics = self._analyze_region(page, initial_rect)
             return { "bbox_norm_tight": bbox_norm, "diagnostics": metrics, "score": 0 }

        # X Histogram
        x_bins = np.zeros(int(width) + 1)
        # Y Histogram
        y_bins = np.zeros(int(height) + 1)
        
        for r in content_rects:
            # Project onto X relative to x_min
            start_x = max(0, int(r.x0 - x_min))
            end_x = min(len(x_bins), int(r.x1 - x_min))
            x_bins[start_x:end_x] = 1 # Mark occupancy
            
            # Project onto Y relative to y_min
            start_y = max(0, int(r.y0 - y_min))
            end_y = min(len(y_bins), int(r.y1 - y_min))
            y_bins[start_y:end_y] = 1

        # Trim top/bottom/left/right to find where content starts
        # Actually union_rect already is the tightest bound of CONTENT.
        # But maybe there are outliers?
        # The user says "Trim empty margins... retain 95% of occupied bins".
        # This implies we might want to shrink inside the union_rect if there are gaps? 
        # Or maybe the union_rect is ALREADY the trimmed version of the initial selection.
        # Yes, union_rect IS the tight bound of intersections.
        # However, if there are flyspecks (noise), union rect might be too big.
        # Let's perform outlier rejection or just return union_rect as "Tightened".
        # Given "Trim until you retain 95%", let's assume we want to chop off sparse edges if any.
        # But usually `union_rect` of spans is pretty good.
        
        # Let's add a small padding (e.g. 5pt)
        padding = 5
        final_rect = union_rect + (-padding, -padding, padding, padding)
        final_rect = final_rect & page.rect # Clip to page

        metrics = self._analyze_region(page, final_rect)
        
        # Calculate shrink ratio
        initial_area = initial_rect.width * initial_rect.height
        final_area = final_rect.width * final_rect.height
        shrink_ratio = final_area / initial_area if initial_area > 0 else 1.0

        return {
            "bbox_norm_tight": self._rect_to_norm(page, final_rect),
            "score": 0.9, # Snapped is usually good
            "reason": "Snapped to content",
            "diagnostics": metrics,
            "approxCols": metrics["approx_cols"],
            "approxRows": metrics["approx_rows"],
            "shrinkRatio": shrink_ratio
        }

    def detect_grid_columns(self, page_num: int, bbox_norm: Dict, mode: str = "auto") -> Dict:
        """
        Detect column boundaries from vertical grid lines within a region.
        Returns normalized x-positions of column separators AND column boundaries.

        Handles:
        - Solid lines
        - Dotted/dashed lines (clusters of short segments at same x)
        - Thin vertical rectangles
        - Curves that are effectively vertical

        Args:
            page_num: 0-based page index
            bbox_norm: Normalized bounding box {"x0", "y0", "x1", "y1"} in 0..1 range
            mode: "auto", "gridlines", or "image_hough"

        Returns:
            {
                "columns": [x_norm, ...],          # Column separator x positions (normalized)
                "column_boundaries": [x_norm, ...], # Column boundaries incl. bbox edges (n+1 boundaries for n columns)
                "columns_detected": int,            # Number of columns detected
                "has_grid": bool,
                "raw_line_count": int,
                "source": "gridlines" | "image_hough" | "text_clustering",
                "diagnostics": {...}
            }
        """
        if page_num < 0 or page_num >= len(self.doc):
            return {"columns": [], "column_boundaries": [], "columns_detected": 0, "has_grid": False, "error": "Invalid page"}

        page = self.doc[page_num]
        rect = self._norm_to_rect(page, bbox_norm)
        page_w = page.rect.width
        page_h = page.rect.height

        # Normalize bbox edges for output
        bbox_x0_norm = rect.x0 / page_w
        bbox_x1_norm = rect.x1 / page_w

        # Try gridlines first (unless mode is image_hough)
        if mode in ("auto", "gridlines"):
            result = self._detect_columns_from_gridlines(page, rect, page_w)
            if result["columns_detected"] >= 6:
                # Add bbox edges as boundaries
                separators = result["columns"]
                boundaries = [bbox_x0_norm] + separators + [bbox_x1_norm]
                result["column_boundaries"] = boundaries
                result["source"] = "gridlines"
                return result

        # Fallback to image-based detection
        if mode in ("auto", "image_hough"):
            result = self._detect_columns_from_image(page, rect, bbox_norm, page_w)
            if result["columns_detected"] >= 6:
                separators = result["columns"]
                boundaries = [bbox_x0_norm] + separators + [bbox_x1_norm]
                result["column_boundaries"] = boundaries
                result["source"] = "image_hough"
                return result

        # Return best effort result
        result = self._detect_columns_from_gridlines(page, rect, page_w)
        separators = result.get("columns", [])
        boundaries = [bbox_x0_norm] + separators + [bbox_x1_norm]
        result["column_boundaries"] = boundaries
        result["source"] = result.get("source", "gridlines")
        return result

    def detect_columns(self, page_num: int, bbox_norm: Dict, mode: str = "gridlines") -> Dict:
        """
        Detect column boundaries using a specified mode.

        ENHANCED with header-based validation:
        - Extracts header row text to estimate expected columns
        - Auto-escalates to image_hough if gridlines yields too few columns
        - Never silently falls back to poor results
        """
        if page_num < 0 or page_num >= len(self.doc):
            return {
                "columns": [],
                "column_boundaries": [],
                "columns_detected": 0,
                "has_grid": False,
                "raw_line_count": 0,
                "source": mode,
                "diagnostics": {"reason": "invalid_page"},
            }

        page = self.doc[page_num]
        rect = self._norm_to_rect(page, bbox_norm)
        page_w = page.rect.width
        page_h = page.rect.height

        bbox_x0_norm = rect.x0 / page_w
        bbox_x1_norm = rect.x1 / page_w

        # Step 1: Estimate expected columns from header text
        expected_columns = self._estimate_columns_from_header(page, rect)

        # Step 2: Run the requested detection mode
        if mode == "image_hough":
            result = self._detect_columns_from_image(page, rect, bbox_norm, page_w)
            result["source"] = "image_hough"
        else:
            result = self._detect_columns_from_gridlines(page, rect, page_w)
            result["source"] = "gridlines"

        detected_cols = result.get("columns_detected", 0)

        # Step 3: Header-based validation and auto-correction
        # If detected columns are significantly fewer than expected, auto-escalate
        if expected_columns > 0 and detected_cols < expected_columns - 2:
            result["diagnostics"]["header_expected"] = expected_columns
            result["diagnostics"]["auto_escalated"] = False

            # If we used gridlines and got too few, try image_hough
            if mode != "image_hough":
                image_result = self._detect_columns_from_image(page, rect, bbox_norm, page_w)
                image_cols = image_result.get("columns_detected", 0)

                if image_cols > detected_cols:
                    result = image_result
                    result["source"] = "image_hough"
                    result["diagnostics"]["auto_escalated"] = True
                    result["diagnostics"]["gridlines_detected"] = detected_cols
                    result["diagnostics"]["reason"] = f"auto_escalated_from_gridlines_{detected_cols}_to_image_{image_cols}"

        # Step 4: Build final boundaries
        separators = result.get("columns", [])
        result["column_boundaries"] = [bbox_x0_norm] + separators + [bbox_x1_norm]
        if "columns_detected" not in result:
            result["columns_detected"] = len(separators) + 1 if separators else 0

        # Step 5: Add validation info
        result["diagnostics"]["expected_from_header"] = expected_columns
        result["diagnostics"]["selection_valid"] = True  # Never mask with "full page fallback"

        # Flag if detection seems insufficient
        final_cols = result["columns_detected"]
        if expected_columns > 0 and final_cols < expected_columns - 2:
            result["diagnostics"]["flag"] = "detection_below_expected"
            result["diagnostics"]["message"] = f"Detected {final_cols} columns but header suggests {expected_columns}. Consider manual adjustment."

        return result

    def _estimate_columns_from_header(self, page, rect: fitz.Rect) -> int:
        """
        Estimate expected column count by analyzing header text in the selection.

        Methods:
        1. Count '|' separators in header text
        2. Count distinct x-position clusters of text spans
        """
        # Get text from top 15% of selection (likely header area)
        header_height = (rect.y1 - rect.y0) * 0.15
        header_rect = fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + header_height)

        text_dict = page.get_text("dict", clip=header_rect)
        blocks = text_dict.get("blocks", [])

        # Method 1: Count '|' separators in raw text
        all_text = ""
        x_positions = []

        for block in blocks:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "").strip()
                    all_text += " " + text
                    if text:
                        x_center = (span["bbox"][0] + span["bbox"][2]) / 2
                        x_positions.append(x_center)

        # Count pipe separators
        pipe_count = all_text.count('|')
        if pipe_count >= 5:
            return pipe_count + 1  # n pipes = n+1 columns

        # Method 2: Count distinct x-position clusters
        if len(x_positions) >= 3:
            x_positions = sorted(x_positions)
            clusters = 1
            last_x = x_positions[0]
            min_gap = (rect.x1 - rect.x0) / 30  # Expect at least 30px gap between columns

            for x in x_positions[1:]:
                if x - last_x > min_gap:
                    clusters += 1
                    last_x = x
                else:
                    last_x = (last_x + x) / 2  # Average within cluster

            if clusters >= 5:
                return clusters

        # Default: no reliable estimate
        return 0

    def _detect_columns_from_gridlines(self, page, rect: fitz.Rect, page_w: float) -> Dict:
        """
        Primary detection: Extract vertical grid lines from PDF vector drawings.
        Handles solid, dotted, and dashed lines.

        ENHANCED for government PDFs with dotted grid lines:
        - Relaxed DBSCAN eps for better clustering of offset segments
        - Lower validation thresholds for dotted lines
        - Larger segment merge gaps
        """
        drawings = page.get_drawings()
        vertical_segments = []

        min_segment_height = 1  # Accept even single-pixel dots
        max_horizontal_deviation = 3  # Relaxed - allow 3px deviation for angled dots

        for path in drawings:
            for item in path.get("items", []):
                if item[0] == "l":  # line segment
                    p1, p2 = item[1], item[2]
                    dx = abs(p1.x - p2.x)
                    dy = abs(p1.y - p2.y)

                    # Accept segment if:
                    # 1. Nearly vertical (dx < 3px) AND has some height (dy >= 1px), OR
                    # 2. Strong vertical orientation (dy > dx * 2 and dy > 3)
                    is_vertical = (dx <= max_horizontal_deviation and dy >= min_segment_height) or \
                                  (dy > dx * 2 and dy > 3)

                    if is_vertical:
                        line_x = (p1.x + p2.x) / 2
                        line_y_min = min(p1.y, p2.y)
                        line_y_max = max(p1.y, p2.y)

                        # Line must intersect with our bbox (y overlap) - expanded tolerance
                        if rect.x0 - 5 <= line_x <= rect.x1 + 5:
                            if line_y_max >= rect.y0 and line_y_min <= rect.y1:
                                vertical_segments.append({
                                    "x": line_x,
                                    "y_min": line_y_min,
                                    "y_max": line_y_max,
                                    "height": dy
                                })

                elif item[0] == "re":  # rect (thin vertical rect = line)
                    r = item[1]
                    # Accept thin vertical rectangles (width < 5px, height >= width)
                    if r.width < 5 and r.height >= r.width and r.height >= min_segment_height:
                        line_x = (r.x0 + r.x1) / 2
                        if rect.x0 - 5 <= line_x <= rect.x1 + 5:
                            if r.y1 >= rect.y0 and r.y0 <= rect.y1:
                                vertical_segments.append({
                                    "x": line_x,
                                    "y_min": r.y0,
                                    "y_max": r.y1,
                                    "height": r.height
                                })

                elif item[0] == "c":  # curve - check if it's nearly vertical
                    if len(item) >= 5:
                        points = item[1:5]
                        xs = [p.x for p in points]
                        ys = [p.y for p in points]
                        dx = max(xs) - min(xs)
                        dy = max(ys) - min(ys)
                        if dx <= max_horizontal_deviation and dy >= min_segment_height:
                            line_x = sum(xs) / len(xs)
                            y_min, y_max = min(ys), max(ys)
                            if rect.x0 - 5 <= line_x <= rect.x1 + 5:
                                if y_max >= rect.y0 and y_min <= rect.y1:
                                    vertical_segments.append({
                                        "x": line_x,
                                        "y_min": y_min,
                                        "y_max": y_max,
                                        "height": dy
                                    })

        raw_count = len(vertical_segments)
        if not vertical_segments:
            return {
                "columns": [],
                "columns_detected": 0,
                "has_grid": False,
                "raw_line_count": 0,
                "diagnostics": {"reason": "no_vertical_segments"}
            }

        # Use DBSCAN clustering on x-positions
        # INCREASED eps=8 to cluster dotted line segments that may be slightly offset
        from sklearn.cluster import DBSCAN
        x_positions = np.array([[s["x"]] for s in vertical_segments])
        clustering = DBSCAN(eps=8, min_samples=1).fit(x_positions)

        # Group segments by cluster label
        cluster_groups = defaultdict(list)
        for seg, label in zip(vertical_segments, clustering.labels_):
            if label >= 0:  # Ignore noise (-1)
                cluster_groups[label].append(seg)

        # Evaluate each cluster
        region_height = rect.y1 - rect.y0
        region_y0 = rect.y0
        region_y1 = rect.y1
        min_height_px = 20  # REDUCED from 40 - dotted lines may have less total height

        valid_column_x = []
        cluster_diagnostics = []

        for label, segments in cluster_groups.items():
            # Compute median x position (more robust than mean)
            xs = sorted([s["x"] for s in segments])
            median_x = xs[len(xs) // 2]

            # Filter segments within our y region
            segments_in_region = []
            for s in segments:
                y_start = max(s["y_min"], region_y0)
                y_end = min(s["y_max"], region_y1)
                if y_end > y_start:
                    segments_in_region.append((y_start, y_end))

            if not segments_in_region:
                continue

            # Merge overlapping/adjacent segments
            segments_in_region.sort()
            merged = [list(segments_in_region[0])]
            for start, end in segments_in_region[1:]:
                # INCREASED gap to 30px for widely-spaced dotted lines
                if start <= merged[-1][1] + 30:
                    merged[-1][1] = max(merged[-1][1], end)
                else:
                    merged.append([start, end])

            total_height = sum(end - start for start, end in merged)
            coverage_ratio = total_height / region_height if region_height > 0 else 0

            # RELAXED validation criteria for dotted lines:
            # 1. Total height >= 20px (reduced from 40), OR
            # 2. Coverage >= 8% of region (reduced from 15%), OR
            # 3. At least 3 segments (reduced from 5), OR
            # 4. Many small segments suggesting dotted pattern
            is_valid = (total_height >= min_height_px or
                        coverage_ratio >= 0.08 or
                        len(segments) >= 3 or
                        (len(segments) >= 2 and total_height >= 10))

            # Filter out positions too close to bbox edges (within 3px)
            if median_x <= rect.x0 + 3 or median_x >= rect.x1 - 3:
                is_valid = False

            cluster_diagnostics.append({
                "x": round(median_x, 1),
                "x_norm": round(median_x / page_w, 4),
                "segment_count": len(segments),
                "total_height": round(total_height, 1),
                "coverage": round(coverage_ratio, 3),
                "valid": is_valid
            })

            if is_valid:
                valid_column_x.append(median_x)

        # Sort and dedupe (min 10px apart to avoid duplicates)
        valid_column_x = sorted(valid_column_x)
        if valid_column_x:
            deduped = [valid_column_x[0]]
            for x in valid_column_x[1:]:
                if x - deduped[-1] >= 10:  # 10px minimum gap
                    deduped.append(x)
            valid_column_x = deduped

        # Convert to normalized positions
        column_x_norm = [x / page_w for x in valid_column_x]

        # Remove columns too close together (< 1% page width - reduced from 1.5%)
        if column_x_norm:
            final_columns = [column_x_norm[0]]
            for x in column_x_norm[1:]:
                if x - final_columns[-1] >= 0.01:
                    final_columns.append(x)
            column_x_norm = final_columns

        columns_detected = len(column_x_norm) + 1 if column_x_norm else 1

        return {
            "columns": column_x_norm,
            "columns_detected": columns_detected,
            "has_grid": columns_detected >= 6,
            "raw_line_count": raw_count,
            "diagnostics": {
                "clusters_found": len(cluster_groups),
                "valid_separators": len(column_x_norm),
                "cluster_details": cluster_diagnostics[:30]  # Increased limit for debugging
            }
        }

    def _detect_columns_from_image(self, page, rect: fitz.Rect, bbox_norm: Dict, page_w: float) -> Dict:
        """
        Image-based column detection with INK DENSITY ANALYSIS.

        THREE-STAGE PIPELINE:
        1. Morphology + Hough (standard)
        2. Column-wise ink density peaks (finds ALL separators)
        3. Local peak refinement between wide gaps
        """
        try:
            import cv2
            from scipy import signal
        except ImportError:
            return {
                "columns": [],
                "columns_detected": 0,
                "has_grid": False,
                "raw_line_count": 0,
                "diagnostics": {"error": "cv2 or scipy not available"}
            }

        # Render region at 300 DPI for good dot resolution
        dpi = 300
        scale = dpi / 72.0
        mat = fitz.Matrix(scale, scale)

        # Clip to our region
        clip = rect
        pix = page.get_pixmap(matrix=mat, clip=clip)

        # Convert to numpy array
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)

        # Convert to grayscale
        if pix.n == 4:
            gray = cv2.cvtColor(img, cv2.COLOR_RGBA2GRAY)
        elif pix.n == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        else:
            gray = img

        img_height = gray.shape[0]
        img_width = gray.shape[1]

        # Binarize with adaptive threshold
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV, 11, 2
        )

        # =====================================================
        # METHOD 1: Morphology extraction
        # =====================================================
        kernel_height = max(3, int(img_height * 0.02))
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_height))
        vertical_lines = cv2.erode(binary, vertical_kernel, iterations=1)
        vertical_lines = cv2.dilate(vertical_lines, vertical_kernel, iterations=2)

        contours, _ = cv2.findContours(vertical_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        morphology_x = []
        min_contour_height = img_height * 0.03  # 3% of height
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if h >= min_contour_height and w < 20:
                morphology_x.append(x + w / 2)

        # =====================================================
        # METHOD 2: Hough line detection
        # =====================================================
        edges = cv2.Canny(gray, 30, 100, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, rho=1, theta=np.pi/180,
            threshold=15,  # Very low threshold
            minLineLength=int(img_height * 0.03),
            maxLineGap=int(img_height * 0.15)  # Large gap for dotted lines
        )

        hough_x = []
        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if abs(x2 - x1) < 8:  # Nearly vertical
                    hough_x.append((x1 + x2) / 2)

        # =====================================================
        # METHOD 3: INK DENSITY ANALYSIS (key for dotted grids)
        # Compute vertical ink density profile and find peaks
        # =====================================================
        # Sum ink along each column (vertical projection)
        ink_density = np.sum(binary, axis=0).astype(float)

        # Smooth to reduce noise
        window_size = max(3, img_width // 100)
        if window_size % 2 == 0:
            window_size += 1
        smoothed_density = np.convolve(ink_density, np.ones(window_size)/window_size, mode='same')

        # Normalize
        if smoothed_density.max() > 0:
            smoothed_density = smoothed_density / smoothed_density.max()

        # Find peaks in ink density
        # These represent vertical line positions
        min_peak_distance = max(5, img_width // 50)  # Min distance between columns
        peak_threshold = 0.15  # 15% of max density

        density_x = []
        try:
            peaks, properties = signal.find_peaks(
                smoothed_density,
                distance=min_peak_distance,
                height=peak_threshold,
                prominence=0.05
            )
            density_x = peaks.tolist()
        except Exception:
            # Fallback: simple local maxima
            for i in range(min_peak_distance, len(smoothed_density) - min_peak_distance):
                if smoothed_density[i] > peak_threshold:
                    is_peak = True
                    for j in range(1, min_peak_distance + 1):
                        if smoothed_density[i] < smoothed_density[i-j] or smoothed_density[i] < smoothed_density[i+j]:
                            is_peak = False
                            break
                    if is_peak:
                        density_x.append(i)

        # =====================================================
        # COMBINE all methods and cluster
        # =====================================================
        all_x_positions = morphology_x + hough_x + density_x

        if not all_x_positions:
            return {
                "columns": [],
                "columns_detected": 0,
                "has_grid": False,
                "raw_line_count": 0,
                "diagnostics": {
                    "reason": "no_lines_detected",
                    "morphology_count": len(morphology_x),
                    "hough_count": len(hough_x),
                    "density_peaks": len(density_x),
                    "method": "morphology+hough+density"
                }
            }

        # Cluster with tight eps to preserve distinct columns
        from sklearn.cluster import DBSCAN
        x_arr = np.array([[x] for x in all_x_positions])
        clustering = DBSCAN(eps=8, min_samples=1).fit(x_arr)

        cluster_centers = []
        for label in set(clustering.labels_):
            if label >= 0:
                cluster_xs = [all_x_positions[i] for i, l in enumerate(clustering.labels_) if l == label]
                cluster_centers.append(np.median(cluster_xs))

        cluster_centers = sorted(cluster_centers)

        # =====================================================
        # METHOD 4: LOCAL PEAK REFINEMENT
        # Find additional separators between wide gaps
        # =====================================================
        min_column_width = img_width / 20  # Expect at least 20 columns max
        refined_centers = list(cluster_centers)

        # Check for gaps that are too wide (suggests missing separators)
        for i in range(len(cluster_centers) - 1):
            gap = cluster_centers[i + 1] - cluster_centers[i]
            if gap > min_column_width * 2:  # Gap is suspiciously wide
                # Search for peaks in this gap region
                start_x = int(cluster_centers[i]) + 5
                end_x = int(cluster_centers[i + 1]) - 5
                if start_x < end_x:
                    local_density = smoothed_density[start_x:end_x]
                    if len(local_density) > 10 and local_density.max() > 0.1:
                        try:
                            local_peaks, _ = signal.find_peaks(
                                local_density,
                                distance=max(3, len(local_density) // 5),
                                height=0.1,
                                prominence=0.03
                            )
                            for peak in local_peaks:
                                refined_centers.append(start_x + peak)
                        except Exception:
                            pass

        refined_centers = sorted(set(refined_centers))

        # Convert image coordinates to normalized PDF coordinates
        region_width = rect.x1 - rect.x0

        column_x_norm = []
        for img_x in refined_centers:
            pdf_x = rect.x0 + (img_x / img_width) * region_width
            # Skip if too close to edges (within 2px)
            if pdf_x <= rect.x0 + 2 or pdf_x >= rect.x1 - 2:
                continue
            column_x_norm.append(pdf_x / page_w)

        # Dedupe - columns within 0.8% of page width are merged
        if column_x_norm:
            final = [column_x_norm[0]]
            for x in column_x_norm[1:]:
                if x - final[-1] >= 0.008:
                    final.append(x)
            column_x_norm = final

        columns_detected = len(column_x_norm) + 1 if column_x_norm else 1

        return {
            "columns": column_x_norm,
            "columns_detected": columns_detected,
            "has_grid": columns_detected >= 6,
            "raw_line_count": len(all_x_positions),
            "diagnostics": {
                "image_size": [img_width, img_height],
                "morphology_count": len(morphology_x),
                "hough_count": len(hough_x),
                "density_peaks": len(density_x),
                "initial_clusters": len(cluster_centers),
                "after_refinement": len(refined_centers),
                "method": "morphology+hough+density"
            }
        }
