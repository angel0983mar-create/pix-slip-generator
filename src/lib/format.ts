export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const iso = value.length === 10 ? `${value}T12:00:00` : value;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function parseAmount(input: string): number {
  const clean = input
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(clean);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}
