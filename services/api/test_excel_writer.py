import pytest
from excel_writer import ExcelWriter
import tempfile
import os

def test_normalize_number():
    writer = ExcelWriter()
    
    assert writer.normalize_number("1,234.56", False) == 1234.56
    assert writer.normalize_number("(100)", False) == -100.0
    assert writer.normalize_number("$1,234.56", False) == 1234.56
    assert writer.normalize_number("€500", False) == 500.0
    
    assert isinstance(writer.normalize_number("abc", False), str)
    assert writer.normalize_number("", False) == ""

def test_normalize_number_keep_currency():
    writer = ExcelWriter()
    
    result = writer.normalize_number("$1,234.56", True)
    assert isinstance(result, str)
    assert "$" in result

def test_write_grid():
    writer = ExcelWriter()
    
    grid = [
        ["Header1", "Header2", "Header3"],
        ["Data1", "Data2", "1,234"],
        ["Data3", "Data4", "(500)"],
    ]
    
    writer.write_grid(grid, "TestSheet", header_depth=1, normalize_numbers=True)
    
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        writer.save(tmp_path)
        assert os.path.exists(tmp_path)
        assert os.path.getsize(tmp_path) > 0
    finally:
        writer.close()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_write_empty_grid():
    writer = ExcelWriter()
    
    writer.write_grid([], "EmptySheet")
    
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        writer.save(tmp_path)
        assert os.path.exists(tmp_path)
    finally:
        writer.close()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def test_write_grid_with_merges():
    writer = ExcelWriter()
    
    grid = [
        ["Merged Header", "", ""],
        ["Data1", "Data2", "Data3"],
    ]
    
    merges = [
        {"start_row": 1, "end_row": 1, "start_col": 1, "end_col": 3}
    ]
    
    writer.write_grid(grid, "MergedSheet", merges=merges)
    
    with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp:
        tmp_path = tmp.name
    
    try:
        writer.save(tmp_path)
        assert os.path.exists(tmp_path)
    finally:
        writer.close()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
