export type ReliabilitySettings = {
  enableBarcode: boolean;
  enableOpenCV: boolean;
  enableOnnx: boolean;
  enableRoiCropping: boolean;
  dpiScale: number; // 2..4 typical
};

const KEY = 'reliabilitySettings_v1';

const DEFAULTS: ReliabilitySettings = {
  enableBarcode: true,
  enableOpenCV: true,
  enableOnnx: true,
  enableRoiCropping: true,
  dpiScale: 3,
};

export const ReliabilitySettingsService = {
  get(): ReliabilitySettings {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed } as ReliabilitySettings;
    } catch {
      return { ...DEFAULTS };
    }
  },

  set(partial: Partial<ReliabilitySettings>) {
    const cur = this.get();
    const next = { ...cur, ...partial } as ReliabilitySettings;
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  },

  reset() {
    localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
    return { ...DEFAULTS };
  },
};

export default ReliabilitySettingsService;

