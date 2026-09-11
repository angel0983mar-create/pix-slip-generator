/**
 * Geração do "Pix Copia e Cola" (BR Code / EMV-QRCPS-MPM) 100% no navegador.
 * Não depende de banco nem de API paga: usa a chave Pix cadastrada pela loja.
 */

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function sanitize(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export function sanitizeTxid(value: string): string {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 25);
  return clean || "PEDIDO";
}

export function normalizePixKey(key: string, type: string): string {
  const trimmed = key.trim();
  if (type === "cpf" || type === "cnpj") return trimmed.replace(/\D/g, "");
  if (type === "telefone") {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("55")) return `+${digits}`;
    return `+55${digits}`;
  }
  if (type === "email") return trimmed.toLowerCase();
  return trimmed;
}

export interface PixInput {
  key: string;
  keyType: string;
  merchantName: string;
  city: string;
  amount: number;
  txid: string;
  description?: string;
}

export function buildPixPayload(input: PixInput): string {
  const key = normalizePixKey(input.key, input.keyType);

  let account = field("00", "BR.GOV.BCB.PIX") + field("01", key);
  if (input.description) {
    const desc = sanitize(input.description, 40);
    if (desc) account += field("02", desc);
  }

  const amount = input.amount > 0 ? input.amount.toFixed(2) : "";

  let payload =
    field("00", "01") +
    field("01", "12") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    (amount ? field("54", amount) : "") +
    field("58", "BR") +
    field("59", sanitize(input.merchantName || "RECEBEDOR", 25) || "RECEBEDOR") +
    field("60", sanitize(input.city || "SAO PAULO", 15) || "SAO PAULO") +
    field("62", field("05", sanitizeTxid(input.txid)));

  payload += "6304";
  return payload + crc16(payload);
}

export const PIX_KEY_TYPES = [
  { value: "aleatoria", label: "Chave aleatória" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
] as const;
