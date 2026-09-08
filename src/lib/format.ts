const nf = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function mm(value: number): string {
  return `${nf.format(value)} mm`;
}

export function num(value: number): string {
  return nf.format(value);
}

export function m2(areaMm2: number): string {
  return `${nf2.format(areaMm2 / 1_000_000)} m²`;
}

export function pct(value: number): string {
  return `${nf.format(value)}%`;
}

export function eur(value: number): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}
