const PALETTE = [
  "oklch(0.78 0.13 70)",
  "oklch(0.72 0.11 200)",
  "oklch(0.74 0.12 150)",
  "oklch(0.72 0.13 20)",
  "oklch(0.72 0.11 300)",
  "oklch(0.78 0.12 110)",
  "oklch(0.7 0.12 250)",
  "oklch(0.76 0.13 45)",
];

export function colorForPart(partId: string): string {
  let hash = 0;
  for (let i = 0; i < partId.length; i++) hash = (hash * 31 + partId.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length]!;
}

const RGB_PALETTE: [number, number, number][] = [
  [246, 226, 196],
  [200, 224, 226],
  [206, 228, 208],
  [240, 210, 210],
  [222, 212, 236],
  [238, 234, 196],
  [206, 216, 238],
  [244, 220, 200],
];

export function rgbForPart(partId: string): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < partId.length; i++) hash = (hash * 31 + partId.charCodeAt(i)) >>> 0;
  return RGB_PALETTE[hash % RGB_PALETTE.length]!;
}
