import Tesseract from 'tesseract.js';
// Dynamic import to keep ONNX runtime lazy-loaded and code-split
// type alias for better TS support without static import
type ORT = typeof import('onnxruntime-web');
let ortRef: ORT | null = null;

/**
 * ONNX OCR (PaddleOCR) Fallback (offline)
 * This is a minimal skeleton that looks for models in /models/paddleocr under the public folder.
 * If models are present, it will attempt to load them and expose a basic recognizeText(canvas) method.
 * If models are missing, all methods return null gracefully. No network calls.
 */
export interface OnnxInitStatus {
  available: boolean;
  message?: string;
}

class OnnxOcrService {
  private detSession: any | null = null;
  private recSession: any | null = null;
  private initialized = false;
  private available = false;

  async initialize(basePath = '/models/paddleocr'): Promise<OnnxInitStatus> {
    if (this.initialized) return { available: this.available };
    this.initialized = true;
    try {
      // Try load small models if present
      const detUrl = `${basePath}/ch_PP-OCRv3_det_infer.onnx`;
      const recUrl = `${basePath}/ch_PP-OCRv3_rec_infer.onnx`;

      // HEAD check to avoid long failures
      const head = async (url: string) => {
        try {
          const r = await fetch(url, { method: 'HEAD' });
          return r.ok;
        } catch {
          return false;
        }
      };

      const [hasDet, hasRec] = await Promise.all([
        head(detUrl), head(recUrl),
      ]);

      if (!hasDet || !hasRec) {
        this.available = false;
        return { available: false, message: 'PaddleOCR ONNX models not found in public/models/paddleocr' };
      }

      const ort = ortRef || (ortRef = await import('onnxruntime-web'));
      this.detSession = await ort.InferenceSession.create(detUrl, { executionProviders: ['wasm'] });
      this.recSession = await ort.InferenceSession.create(recUrl, { executionProviders: ['wasm'] });

      this.available = true;
      return { available: true };
    } catch (e: any) {
      console.warn('ONNX OCR init failed:', e?.message || e);
      this.available = false;
      return { available: false, message: 'Failed to initialize ONNX OCR' };
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Recognize text from a full-page canvas using PP-OCR style pipeline.
   * Implementation notes:
   * - Runs detection (DB-like) to get probability map and extracts connected components as ROIs
   * - Crops each ROI from original canvas and uses Tesseract for recognition (CRNN optional)
   * - Returns concatenated text ordered by top-to-bottom, then left-to-right
   */
  async recognizeText(canvas: HTMLCanvasElement): Promise<string | null> {
    if (!this.available || !this.detSession || !this.recSession) return null;
    try {
      const ort = ortRef || (ortRef = await import('onnxruntime-web'));

      // 1) Prepare input tensor [1,3,H,W] with H,W multiple of 32
      const targetW = 960; // reasonable width; model supports dynamic shapes
      const scale = targetW / canvas.width;
      const targetHRaw = Math.round(canvas.height * scale);
      const targetH = Math.max(32, Math.round(targetHRaw / 32) * 32);
      const prep = document.createElement('canvas');
      prep.width = targetW; prep.height = targetH;
      const pctx = prep.getContext('2d');
      if (!pctx) return null;
      pctx.drawImage(canvas, 0, 0, targetW, targetH);
      const imgData = pctx.getImageData(0, 0, targetW, targetH).data;
      const chw = new Float32Array(1 * 3 * targetH * targetW);
      // normalize to [-1,1] as (x/255 - 0.5)/0.5
      let idxR = 0, idxG = targetH * targetW, idxB = 2 * targetH * targetW;
      for (let i = 0, px = 0; i < imgData.length; i += 4, px++) {
        const r = (imgData[i] / 255 - 0.5) / 0.5;
        const g = (imgData[i + 1] / 255 - 0.5) / 0.5;
        const b = (imgData[i + 2] / 255 - 0.5) / 0.5;
        chw[idxR++] = r; chw[idxG++] = g; chw[idxB++] = b;
      }
      const inputName = this.detSession.inputNames?.[0] || 'input';
      const detFeeds: Record<string, any> = {};
      detFeeds[inputName] = new ort.Tensor('float32', chw, [1, 3, targetH, targetW]);

      // 2) Run detection
      const detOut = await this.detSession.run(detFeeds);
      const outName = this.detSession.outputNames?.[0] || Object.keys(detOut)[0];
      const outTensor = detOut[outName];
      if (!outTensor || !outTensor.data || !outTensor.dims) return null;
      // Expect [1,1,Hm,Wm] or [1,Hm,Wm,1]
      let outH = 0, outW = 0;
      if (outTensor.dims.length === 4) {
        // try NCHW
        outH = outTensor.dims[2]; outW = outTensor.dims[3];
        if (outH * outW !== outTensor.data.length && outTensor.dims[1] === outTensor.dims[3]) {
          // Probably NHWC, swap
          outH = outTensor.dims[1]; outW = outTensor.dims[2];
        }
      } else {
        return null;
      }
      const prob = outTensor.data as Float32Array | Float64Array;

      // 3) Threshold and connected components on det map
      const mask = new Uint8Array(outH * outW);
      const TH = 0.3;
      for (let i = 0; i < outH * outW; i++) mask[i] = prob[i] > TH ? 1 : 0;
      const visited = new Uint8Array(outH * outW);
      const boxes: Array<{x0:number,y0:number,x1:number,y1:number}> = [];
      const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
      for (let y = 0; y < outH; y++) {
        for (let x = 0; x < outW; x++) {
          const idx = y * outW + x;
          if (!mask[idx] || visited[idx]) continue;
          let qx = [x], qy = [y], qi = 0;
          visited[idx] = 1;
          let minX = x, minY = y, maxX = x, maxY = y, area = 0;
          while (qi < qx.length) {
            const cx = qx[qi], cy = qy[qi]; qi++;
            area++;
            for (const [dx,dy] of neighbors) {
              const nx = cx + dx, ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= outW || ny >= outH) continue;
              const nidx = ny * outW + nx;
              if (!mask[nidx] || visited[nidx]) continue;
              visited[nidx] = 1;
              if (nx < minX) minX = nx; if (ny < minY) minY = ny;
              if (nx > maxX) maxX = nx; if (ny > maxY) maxY = ny;
              qx.push(nx); qy.push(ny);
            }
          }
          if (area >= 20) { // small area filter
            boxes.push({ x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 });
          }
        }
      }
      if (boxes.length === 0) return null;

      // 4) Recognize each ROI from original canvas using Tesseract (psm 7)
      const factorX = canvas.width / outW;
      const factorY = canvas.height / outH;
      const results: Array<{text:string, x:number, y:number}> = [];
      for (const b of boxes) {
        const rx0 = Math.max(0, Math.floor(b.x0 * factorX));
        const ry0 = Math.max(0, Math.floor(b.y0 * factorY));
        const rx1 = Math.min(canvas.width, Math.ceil(b.x1 * factorX));
        const ry1 = Math.min(canvas.height, Math.ceil(b.y1 * factorY));
        const rw = Math.max(1, rx1 - rx0);
        const rh = Math.max(1, ry1 - ry0);
        const roi = document.createElement('canvas');
        roi.width = rw; roi.height = rh;
        const rctx = roi.getContext('2d');
        if (!rctx) continue;
        rctx.drawImage(canvas, rx0, ry0, rw, rh, 0, 0, rw, rh);
        try {
          const rec = await Tesseract.recognize(roi, 'eng', { tessedit_pageseg_mode: 7 } as any);
          const txt = (rec?.data?.text || '').trim();
          if (txt) results.push({ text: txt, x: rx0, y: ry0 });
        } catch {}
      }
      if (results.length === 0) return null;
      results.sort((a,b) => a.y === b.y ? a.x - b.x : a.y - b.y);
      return results.map(r => r.text).join('\n');
    } catch (e) {
      console.warn('ONNX OCR recognizeText failed', e);
      return null;
    }
  }
}

export const onnxOcrService = new OnnxOcrService();
export default onnxOcrService;

