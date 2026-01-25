export interface NormalizedBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BlockSignature {
  page: number;
  region_id: number;
  bbox_norm: NormalizedBBox;
  density: number; // characters per unit area
}

export interface ColumnXSignature {
  page: number;
  xs_norm: number[]; // Normalized X coordinates of column centers
}

export interface HeaderFooterSignature {
  header_text_hash: string;
  footer_text_hash: string;
}

export interface FingerprintV1 {
  version: '1.0';
  is_scanned: boolean;
  page_count: number;
  top_keywords: string[];
  blocks_signature: BlockSignature[];
  column_x_signature: ColumnXSignature[];
  header_footer_signature: HeaderFooterSignature;
}
