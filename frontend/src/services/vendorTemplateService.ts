/**
 * Vendor Template Service
 * Stores vendor-specific anchor overrides in localStorage (offline, portable).
 */

export type VendorAnchorTemplate = Record<string, string[]>; // field -> anchors
export type VendorTemplates = Record<string, VendorAnchorTemplate>; // vendorKey -> template

function vendorKey(name: string | undefined): string | null {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const STORAGE_KEY = 'syntaxis_vendor_templates_v1';

function load(): VendorTemplates {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as VendorTemplates;
  } catch {
    return {};
  }
}

function save(templates: VendorTemplates) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn('Failed to persist vendor templates', e);
  }
}

export class VendorTemplateService {
  static getAnchorsForVendor(name?: string): VendorAnchorTemplate | undefined {
    const key = vendorKey(name);
    if (!key) return undefined;
    const all = load();
    return all[key];
  }

  static upsertVendorAnchors(name: string, field: string, anchors: string[]) {
    const key = vendorKey(name);
    if (!key) return;
    const all = load();
    const tpl = all[key] || {};
    const existing = new Set([...(tpl[field] || [])]);
    for (const a of anchors) existing.add(a);
    tpl[field] = Array.from(existing);
    all[key] = tpl;
    save(all);
  }

  static setVendorTemplate(name: string, template: VendorAnchorTemplate) {
    const key = vendorKey(name);
    if (!key) return;
    const all = load();
    all[key] = template;
    save(all);
  }

  static listVendors(): string[] {
    const all = load();
    return Object.keys(all);
  }
}

export default VendorTemplateService;

