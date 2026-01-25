import pytest
from extraction_engine import PDFExtractor, TextSpan
import tempfile
import os

def test_text_span_properties():
    span = TextSpan("Test", (10, 20, 50, 40), 0)
    
    assert span.x0 == 10
    assert span.y0 == 20
    assert span.x1 == 50
    assert span.y1 == 40
    assert span.x_center == 30
    assert span.y_center == 30
    assert span.page == 0
    assert span.text == "Test"

def test_cluster_columns_with_guides():
    extractor = PDFExtractor.__new__(PDFExtractor)
    
    spans = [
        TextSpan("A", (10, 10, 20, 20), 0),
        TextSpan("B", (60, 10, 70, 20), 0),
        TextSpan("C", (110, 10, 120, 20), 0),
    ]
    
    guides = [40, 90]
    
    columns = extractor.cluster_columns(spans, guides)
    
    assert len(columns) == 3
    assert columns[0][0].text == "A"
    assert columns[1][0].text == "B"
    assert columns[2][0].text == "C"

def test_cluster_columns_auto():
    extractor = PDFExtractor.__new__(PDFExtractor)
    
    spans = [
        TextSpan("A1", (10, 10, 20, 20), 0),
        TextSpan("A2", (12, 30, 22, 40), 0),
        TextSpan("B1", (60, 10, 70, 20), 0),
        TextSpan("B2", (62, 30, 72, 40), 0),
    ]
    
    columns = extractor.cluster_columns(spans, None, tolerance=10)
    
    assert len(columns) == 2

def test_cluster_rows():
    extractor = PDFExtractor.__new__(PDFExtractor)
    
    spans = [
        TextSpan("A", (10, 10, 20, 20), 0),
        TextSpan("B", (60, 12, 70, 22), 0),
        TextSpan("C", (10, 50, 20, 60), 0),
        TextSpan("D", (60, 52, 70, 62), 0),
    ]
    
    rows = extractor.cluster_rows(spans, tolerance=5)
    
    assert len(rows) == 2

def test_build_grid():
    extractor = PDFExtractor.__new__(PDFExtractor)
    
    spans = [
        TextSpan("Header1", (10, 10, 50, 20), 0),
        TextSpan("Header2", (70, 10, 110, 20), 0),
        TextSpan("Data1", (10, 30, 50, 40), 0),
        TextSpan("Data2", (70, 30, 110, 40), 0),
    ]
    
    grid = extractor.build_grid(spans, None)
    
    assert len(grid) > 0
    assert isinstance(grid, list)
    assert all(isinstance(row, list) for row in grid)

def test_empty_spans():
    extractor = PDFExtractor.__new__(PDFExtractor)
    
    columns = extractor.cluster_columns([], None)
    assert columns == {}
    
    rows = extractor.cluster_rows([])
    assert rows == {}
    
    grid = extractor.build_grid([])
    assert grid == []

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
