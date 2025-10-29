export function sanitizeSvg(raw) {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[^>]*\?>\s*/gi, '')
    .replace(/<!DOCTYPE[^>]*>\s*/gi, '')
    .replace(/\s+xmlns:xlink="[^"]*"/gi, '')
    .replace(/\s+xmlns:svg="[^"]*"/gi, '')
    .replace(/\s+xmlns:ev="[^"]*"/gi, '')
    .trim();
}
