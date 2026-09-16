/**
 * Armazenamento local (sem conta): produtos, dados da loja e numeração de pedidos.
 * Permite usar o PDV antes de criar a conta do Google.
 */
import type { Product, Profile } from "./domain";
import type { BusinessBranch } from "./business-branches";

const PRODUCTS_KEY = "cpx.local.products";
const SETTINGS_KEY = "cpx.local.settings";
const COUNTER_KEY = "cpx.local.counter";

export interface LocalSettings {
  store_name: string;
  merchant_name: string;
  city: string;
  phone: string | null;
  document: string | null;
  pix_key: string | null;
  pix_key_type: string;
  print_layout: "a4" | "cupom";
  receipt_footer: string | null;
  business_branch: BusinessBranch;
  store_logo_url: string | null;
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  store_name: "Minha loja",
  merchant_name: "",
  city: "SAO PAULO",
  phone: null,
  document: null,
  pix_key: null,
  pix_key_type: "aleatoria",
  print_layout: "a4",
  receipt_footer: null,
  business_branch: "mercado",
  store_logo_url: null,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadLocalSettings(): LocalSettings {
  return read<LocalSettings>(SETTINGS_KEY, DEFAULT_LOCAL_SETTINGS);
}

export function saveLocalSettings(values: Partial<LocalSettings>): LocalSettings {
  const next = { ...loadLocalSettings(), ...values };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function loadLocalProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PRODUCTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Product[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalProducts(products: Product[]) {
  window.localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function nextLocalOrderNumber(): number {
  const current = Number(window.localStorage.getItem(COUNTER_KEY) ?? "0") + 1;
  window.localStorage.setItem(COUNTER_KEY, String(current));
  return current;
}

/** Converte os dados locais no mesmo formato do perfil salvo na conta. */
export function localProfile(settings: LocalSettings = loadLocalSettings()): Profile {
  return {
    id: "local",
    store_name: settings.store_name,
    merchant_name: settings.merchant_name,
    city: settings.city,
    phone: settings.phone,
    document: settings.document,
    pix_key: settings.pix_key,
    pix_key_type: settings.pix_key_type,
    print_layout: settings.print_layout,
    receipt_footer: settings.receipt_footer,
    business_branch: settings.business_branch ?? "mercado",
    store_logo_url: settings.store_logo_url ?? null,
    plan: "local",
    open_order_limit: 999,
    next_order_number: 1,
  };
}
