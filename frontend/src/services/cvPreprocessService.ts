import cv from '@techstark/opencv-js';

/**
 * OpenCV.js preprocessing helpers for OCR (offline)
 * Provides lightweight deskew and contrast/threshold enhancements.
 */
export interface PreprocessOptions {
  adaptive?: boolean; // adaptive threshold
  deskew?: boolean;   // attempt deskew via Hough lines
  invertIfNeeded?: boolean; // check histogram and invert if dark bg
}

export class CVPreprocessService {
  private static readyPromise: Promise<void> | null = null;

  static async ensureReady(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = new Promise((resolve) => {
        const check = () => {
          if ((cv as any).ready) resolve();
          else setTimeout(check, 10);
        };
        check();
      });
    }
    return this.readyPromise;
  }

  static async enhanceForOCR(srcCanvas: HTMLCanvasElement, opts: PreprocessOptions = {}): Promise<HTMLCanvasElement> {
    await this.ensureReady();

    const options: Required<PreprocessOptions> = {
      adaptive: true,
      deskew: false,
      invertIfNeeded: true,
      ...opts,
    } as any;

    const src = cv.imread(srcCanvas);
    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // Optional deskew via Hough lines (simple heuristic)
    if (options.deskew) {
      const edges = new cv.Mat();
      cv.Canny(gray, edges, 50, 150);
      const lines = new cv.Mat();
      cv.HoughLines(edges, lines, 1, Math.PI / 180, 150);
      let angle = 0;
      if (lines.rows > 0) {
        // average line angle near 0 or 90 degrees
        let sum = 0, count = 0;
        for (let i = 0; i < lines.rows; i++) {
          const theta = lines.data32F[i * 2 + 1];
          const deg = (theta * 180) / Math.PI;
          // map to [-45, 45]
          const norm = ((deg + 45) % 90) - 45;
          sum += norm; count++;
        }
        angle = count ? sum / count : 0;
      }
      if (Math.abs(angle) > 0.5) {
        gray = this.rotate(gray, angle);
      }
      edges.delete(); lines.delete();
    }

    // Adaptive threshold to increase contrast
    let bin = new cv.Mat();
    if (options.adaptive) {
      cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 31, 10);
    } else {
      cv.threshold(gray, bin, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    }

    // Optional inversion based on histogram
    if (options.invertIfNeeded) {
      const inv = new cv.Mat();
      cv.bitwise_not(bin, inv);
      const shouldInvert = this.shouldInvert(bin, inv);
      if (shouldInvert) {
        bin.delete();
        bin = inv;
      } else {
        inv.delete();
      }
    }

    // Write back to canvas
    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = srcCanvas.width;
    dstCanvas.height = srcCanvas.height;
    cv.imshow(dstCanvas, bin);

    src.delete(); gray.delete(); bin.delete();

    return dstCanvas;
  }

  private static rotate(mat: cv.Mat, angleDeg: number): cv.Mat {
    const center = new cv.Point(mat.cols / 2, mat.rows / 2);
    const M = cv.getRotationMatrix2D(center, angleDeg, 1);
    const dst = new cv.Mat();
    const b = new cv.Size(mat.cols, mat.rows);
    cv.warpAffine(mat, dst, M, b, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
    M.delete();
    mat.delete();
    return dst;
  }

  private static shouldInvert(bin: cv.Mat, inv: cv.Mat): boolean {
    // compare mean intensity and choose the version with darker text (lower mean)
    const meanBin = cv.mean(bin)[0];
    const meanInv = cv.mean(inv)[0];
    // prefer lower mean (darker text on bright background)
    return meanInv < meanBin;
  }
}

export default CVPreprocessService;

