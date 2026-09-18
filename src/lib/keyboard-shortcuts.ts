export type ShortcutActionId =
  | "focus_barcode"
  | "open_free_item"
  | "open_weigh"
  | "checkout"
  | "clear_cart"
  | "open_shortcuts";

export interface ShortcutDefinition {
  id: ShortcutActionId;
  label: string;
  defaultKey: string;
  description: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  {
    id: "focus_barcode",
    label: "Leitor de código de barras",
    defaultKey: "F1",
    description: "Foca o cursor imediatamente no campo de código de barras para bipar.",
  },
  {
    id: "open_free_item",
    label: "Incluir item avulso sem cadastro",
    defaultKey: "F2",
    description: "Abre o painel rápido para lançar valor e descrição de item avulso.",
  },
  {
    id: "open_weigh",
    label: "Balança / Pesar por Kg",
    defaultKey: "F3",
    description: "Abre a calculadora de hortifrúti e frios por peso (gramas).",
  },
  {
    id: "checkout",
    label: "Finalizar e gerar cobrança Pix",
    defaultKey: "F4",
    description: "Finaliza o carrinho e gera o QR Code de pagamento.",
  },
  {
    id: "clear_cart",
    label: "Limpar carrinho",
    defaultKey: "F8",
    description: "Remove todos os itens lançados no carrinho atual.",
  },
  {
    id: "open_shortcuts",
    label: "Ajuda de atalhos",
    defaultKey: "F9",
    description: "Exibe a tela de consulta de todos os atalhos ativos.",
  },
];

export const AVAILABLE_SHORTCUT_KEYS = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "Insert",
  "Alt+A",
  "Alt+B",
  "Alt+C",
  "Alt+F",
  "Alt+L",
  "Alt+P",
  "Alt+S",
];

const SHORTCUTS_STORAGE_KEY = "cpx.keyboard_shortcuts.v1";

export function loadShortcutsConfig(): Record<ShortcutActionId, string> {
  const defaults: Record<ShortcutActionId, string> = {
    focus_barcode: "F1",
    open_free_item: "F2",
    open_weigh: "F3",
    checkout: "F4",
    clear_cart: "F8",
    open_shortcuts: "F9",
  };

  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveShortcutsConfig(config: Partial<Record<ShortcutActionId, string>>) {
  if (typeof window === "undefined") return;
  const current = loadShortcutsConfig();
  const next = { ...current, ...config };
  window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function matchesKey(event: KeyboardEvent, targetKey: string): boolean {
  if (!targetKey) return false;
  const normTarget = targetKey.toUpperCase().trim();

  // Caso com modificador Alt+X
  if (normTarget.startsWith("ALT+")) {
    const letter = normTarget.slice(4).trim();
    return event.altKey && event.key.toUpperCase() === letter;
  }

  // Caso com modificador Ctrl+X
  if (normTarget.startsWith("CTRL+")) {
    const letter = normTarget.slice(5).trim();
    return event.ctrlKey && event.key.toUpperCase() === letter;
  }

  // Tecla simples (F1..F12, Insert, Delete, +, -, Esc, etc.)
  return (
    event.key.toUpperCase() === normTarget &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
