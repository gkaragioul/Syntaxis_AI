import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../api"))

from celery_config import celery_app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import BatchJob, BatchJobItem, Document, Template, BatchJobStatus, BatchItemStatus, DocumentMatchStatus
from extraction_engine import PDFExtractor
from excel_writer import ExcelWriter
from pathlib import Path
import zipfile
from datetime import datetime
from typing import Optional

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../api/pdf_extractor.db")

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

OUTPUT_DIR = Path("../api/outputs")

@celery_app.task(name="process_batch_job")
def process_batch_job(batch_job_id: int):
    db = SessionLocal()
    
    try:
        batch_job = db.query(BatchJob).filter(BatchJob.id == batch_job_id).first()
        
        if not batch_job:
            return {"status": "error", "message": "Batch job not found"}
        
        batch_job.status = BatchJobStatus.RUNNING
        db.commit()
        
        template = db.query(Template).filter(Template.id == batch_job.template_id).first()
        
        if not template:
            batch_job.status = BatchJobStatus.FAILED
            db.commit()
            return {"status": "error", "message": "Template not found"}
        
        template_schema = template.schema_json
        
        output_dir = OUTPUT_DIR / str(batch_job.user_id) / f"batch_{batch_job.id}"
        output_dir.mkdir(parents=True, exist_ok=True)
        
        all_success = True
        
        for item in batch_job.items:
            try:
                document = db.query(Document).filter(Document.id == item.document_id).first()
                
                if not document:
                    item.status = BatchItemStatus.FAILED
                    item.warnings_json = {"error": "Document not found"}
                    all_success = False
                    continue
                
                extractor = PDFExtractor(document.storage_path)
                
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
                
                output_filename = f"{document.filename.replace('.pdf', '')}.xlsx"
                output_path = output_dir / output_filename
                
                writer = ExcelWriter()
                header_depth = template_schema.get("tables", [{}])[0].get("header", {}).get("depthRows", 0)
                sheet_name = template_schema.get("tables", [{}])[0].get("output", {}).get("sheetName", "Sheet1")
                writer.write_grid(all_grids, sheet_name, header_depth=header_depth)
                writer.save(str(output_path))
                writer.close()
                
                item.output_paths_json = {"excel": str(output_path)}
                
                if warnings:
                    item.status = BatchItemStatus.WARNING
                    item.warnings_json = {"warnings": warnings}
                else:
                    item.status = BatchItemStatus.SUCCESS
                
            except Exception as e:
                item.status = BatchItemStatus.FAILED
                item.warnings_json = {"error": str(e)}
                all_success = False
        
        db.commit()
        
        zip_path = output_dir / f"batch_{batch_job.id}_results.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for item in batch_job.items:
                if item.output_paths_json and item.output_paths_json.get("excel"):
                    excel_path = Path(item.output_paths_json["excel"])
                    if excel_path.exists():
                        zipf.write(excel_path, excel_path.name)
        
        batch_job.status = BatchJobStatus.DONE
        batch_job.finished_at = datetime.utcnow()
        db.commit()
        
        return {
            "status": "success",
            "batch_job_id": batch_job.id,
            "zip_path": str(zip_path)
        }
        
    except Exception as e:
        if batch_job:
            batch_job.status = BatchJobStatus.FAILED
            batch_job.finished_at = datetime.utcnow()
            db.commit()
        
        return {"status": "error", "message": str(e)}

    finally:
        db.close()


@celery_app.task(name="process_batch_job_v2")
def process_batch_job_v2(batch_job_id: int, template_id: Optional[int] = None):
    """
    Process a batch job using per-document template matching.
    If template_id is provided, only process documents matched to that template.
    Otherwise, process all matched documents using their respective templates.
    """
    db = SessionLocal()

    try:
        batch_job = db.query(BatchJob).filter(BatchJob.id == batch_job_id).first()

        if not batch_job:
            return {"status": "error", "message": "Batch job not found"}

        batch_job.status = BatchJobStatus.RUNNING
        db.commit()

        output_dir = OUTPUT_DIR / str(batch_job.user_id) / f"batch_{batch_job.id}"
        output_dir.mkdir(parents=True, exist_ok=True)

        all_success = True
        processed_count = 0

        for item in batch_job.items:
            try:
                document = db.query(Document).filter(Document.id == item.document_id).first()

                if not document:
                    item.status = BatchItemStatus.FAILED
                    item.warnings_json = {"error": "Document not found"}
                    all_success = False
                    continue

                # Skip documents that don't match the filter criteria
                if template_id:
                    if document.matched_template_id != template_id:
                        continue
                else:
                    # Only process matched documents
                    if document.match_status != DocumentMatchStatus.MATCHED:
                        continue
                    if not document.matched_template_id:
                        continue

                # Get the template for this document
                doc_template = db.query(Template).filter(
                    Template.id == document.matched_template_id
                ).first()

                if not doc_template:
                    item.status = BatchItemStatus.FAILED
                    item.warnings_json = {"error": "Matched template not found"}
                    all_success = False
                    continue

                template_schema = doc_template.schema_json

                extractor = PDFExtractor(document.storage_path)

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

                            # Drift detection
                            drift = table_config.get("driftDetection", {})
                            expected_cols = drift.get("requiredColumnCount")
                            if expected_cols and grid and len(grid[0]) != expected_cols:
                                warnings.append(f"Column count mismatch: expected {expected_cols}, got {len(grid[0])}")

                extractor.close()

                output_filename = f"{document.filename.replace('.pdf', '')}.xlsx"
                output_path = output_dir / output_filename

                writer = ExcelWriter()
                header_depth = template_schema.get("tables", [{}])[0].get("header", {}).get("depthRows", 0)
                sheet_name = template_schema.get("tables", [{}])[0].get("output", {}).get("sheetName", "Sheet1")
                writer.write_grid(all_grids, sheet_name, header_depth=header_depth)
                writer.save(str(output_path))
                writer.close()

                item.output_paths_json = {"excel": str(output_path)}

                if warnings:
                    item.status = BatchItemStatus.WARNING
                    item.warnings_json = {"warnings": warnings}
                else:
                    item.status = BatchItemStatus.SUCCESS

                processed_count += 1

            except Exception as e:
                item.status = BatchItemStatus.FAILED
                item.warnings_json = {"error": str(e)}
                all_success = False

        db.commit()

        # Create zip file with results
        zip_path = output_dir / f"batch_{batch_job.id}_results.zip"
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for item in batch_job.items:
                if item.output_paths_json and item.output_paths_json.get("excel"):
                    excel_path = Path(item.output_paths_json["excel"])
                    if excel_path.exists():
                        zipf.write(excel_path, excel_path.name)

        batch_job.status = BatchJobStatus.DONE
        batch_job.finished_at = datetime.utcnow()
        db.commit()

        return {
            "status": "success",
            "batch_job_id": batch_job.id,
            "processed_count": processed_count,
            "zip_path": str(zip_path)
        }

    except Exception as e:
        if batch_job:
            batch_job.status = BatchJobStatus.FAILED
            batch_job.finished_at = datetime.utcnow()
            db.commit()

        return {"status": "error", "message": str(e)}

    finally:
        db.close()
