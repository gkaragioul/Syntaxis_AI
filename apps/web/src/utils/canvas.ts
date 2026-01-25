export interface Point {
  x: number;
  y: number;
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts a PDF point (72 DPI usually) to a Canvas pixel coordinate.
 * scale is the current zoom level of the PDF render (e.g. 1.0, 1.5).
 */
export const pdfToCanvas = (point: Point, scale: number): Point => {
  return {
    x: point.x * scale,
    y: point.y * scale,
  };
};

/**
 * Converts a Canvas pixel coordinate back to PDF point space.
 */
export const canvasToPdf = (point: Point, scale: number): Point => {
  return {
    x: point.x / scale,
    y: point.y / scale,
  };
};

/**
 * Converts a BBox (x0,y0,x1,y1) from PDF space to a Rect (x,y,w,h) for Canvas drawing.
 */
export const bboxToRect = (bbox: BBox, scale: number): Rect => {
  return {
    x: bbox.x0 * scale,
    y: bbox.y0 * scale,
    width: (bbox.x1 - bbox.x0) * scale,
    height: (bbox.y1 - bbox.y0) * scale,
  };
};

/**
 * Normalizes a rectangle created by dragging from startPoint to endPoint
 * so that width/height are always positive.
 */
export const normalizeRect = (start: Point, end: Point): BBox => {
  return {
    x0: Math.min(start.x, end.x),
    y0: Math.min(start.y, end.y),
    x1: Math.max(start.x, end.x),
    y1: Math.max(start.y, end.y),
  };
};

/**
 * Checks if a point is inside a rectangle.
 */
export const isPointInRect = (point: Point, rect: Rect): boolean => {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
};
