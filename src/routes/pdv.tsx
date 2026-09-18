import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Copy,
  Image as ImageIcon,
  Minus,
  Package,
  Plus,
  Printer,
  Settings,
  ShoppingCart,
  Trash2,
  UserPlus,
  Lightbulb,
  Scale,
  Percent,
  ChefHat,
  Wrench,
  ChevronDown,
  Tag,
  Loader2,
  Keyboard,
  HelpCircle,
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PixQr, usePixQr } from "@/components/PixQr";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/hooks/useStore";
import { useProducts } from "@/hooks/useCatalog";
import { PAYMENT_METHODS, type Order, type OrderItem, type Profile } from "@/lib/domain";
import { formatBRL, parseAmount } from "@/lib/format";
import { buildPixPayload, PIX_KEY_TYPES } from "@/lib/pix";
import { printReceipt } from "@/lib/receipt";
import { buildReceiptImage, downloadDataUrl } from "@/lib/receipt-image";
import {
  loadLocalSettings,
  localProfile,
  nextLocalOrderNumber,
  saveLocalSettings,
  type LocalSettings,
} from "@/lib/local-store";
import {
  BUSINESS_BRANCHES,
  type BusinessBranch,
} from "@/lib/business-branches";
import { BranchWishlistModal } from "@/components/BranchWishlistModal";
import { KeyboardShortcutsModal } from "@/components/KeyboardShortcutsModal";
import { LogoUploader } from "@/components/LogoUploader";
import {
  loadShortcutsConfig,
  matchesKey,
  type ShortcutActionId,
} from "@/lib/keyboard-shortcuts";

export const Route = createFileRoute("/pdv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PDV Minimalista por Ramo | Comprovante Pix" },
      {
        name: "description",
        content:
          "PDV rápido de inserção contínua por código de barras, atalhos de teclado e cobrança Pix imediata.",
      },
      { property: "og:title", content: "PDV Rápido Minimalista" },
      {
        property: "og:description",
        content: "PDV ágil operado 100% pelo teclado com leitor de código de barras e Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdvPage,
});

interface CartLine extends OrderItem {
  key: string;
  note?: string | undefined;
}

const PAYMENT_OPTIONS = [
  { id: "pix", label: "Pix", hotkey: "1", icon: QrCode },
  { id: "dinheiro", label: "Dinheiro", hotkey: "2", icon: Banknote },
  { id: "credito", label: "Crédito", hotkey: "3", icon: CreditCard },
  { id: "debito", label: "Débito", hotkey: "4", icon: CreditCard },
];

const DISCOUNT_OPTIONS = [
  { pct: 0, label: "0%", hotkey: "Alt+0" },
  { pct: 5, label: "5%", hotkey: "Alt+5" },
  { pct: 10, label: "10%", hotkey: "Alt+1" },
  { pct: 15, label: "15%", hotkey: "Alt+2" },
  { pct: 20, label: "20%", hotkey: "Alt+3" },
];

function PdvPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;
  const { data: remoteProfile } = useProfile();
  const { data: products = [], isLoading: productsLoading } = useProducts();

  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const profile: Profile | null = isGuest ? localProfile(settings) : (remoteProfile ?? null);

  // Ramo definido nas Configurações da Loja
  const currentBranch: BusinessBranch =
    ((isGuest ? settings.business_branch : remoteProfile?.business_branch) as BusinessBranch) ||
    "mercado";

  // Atalhos de teclado
  const [shortcutsConfig, setShortcutsConfig] = useState<Record<ShortcutActionId, string>>(() =>
    loadShortcutsConfig(),
  );
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);

  // Modal de Pesagem (Mercado)
  const [scaleItemName, setScaleItemName] = useState("");
  const [scalePriceKg, setScalePriceKg] = useState("");
  const [scaleGrams, setScaleGrams] = useState("");

  // Inserção de Item Avulso Inline
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");
  const [freeNote, setFreeNote] = useState("");

  // Campos específicos por ramo
  const [tableNumber, setTableNumber] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Estado do Carrinho e Inserção
  const [code, setCode] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const freeNameRef = useRef<HTMLInputElement>(null);

  const subtotal = lines.reduce((acc, line) => acc + line.qty * line.price, 0);
  const discountValue = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal - discountValue);
  const qtyCount = lines.reduce((acc, line) => acc + line.qty, 0);

  const branchConfig = BUSINESS_BRANCHES[currentBranch] ?? BUSINESS_BRANCHES.mercado;

  // Auto-foco no campo de inserção ao carregar
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  function addLine(name: string, price: number, qty = 1, note?: string) {
    setLines((current) => {
      const foundIndex = current.findIndex(
        (l) => l.name === name && l.price === price && l.note === note,
      );
      if (foundIndex >= 0 && current[foundIndex]) {
        const existing = current[foundIndex];
        const updated = [...current];
        updated[foundIndex] = {
          ...existing,
          qty: existing.qty + qty,
        };
        return updated;
      }
      const newLine: CartLine = {
        key: `${name}-${Date.now()}-${Math.random()}`,
        name,
        qty,
        price,
        note,
      };
      return [...current, newLine];
    });
  }

  function changeQty(key: string, delta: number) {
    setLines((current) =>
      current
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((l) => l.key !== key));
  }

  // Inserção rápida por código ou busca
  function submitCode(event?: React.FormEvent) {
    if (event) event.preventDefault();
    const raw = code.trim();
    if (!raw) return;

    // Suporte a multiplicador: ex: 3*7891234 ou 2*15.50
    let qtyToInsert = 1;
    let codeToSearch = raw;
    if (raw.includes("*")) {
      const parts = raw.split("*");
      const firstPart = parts[0]?.trim();
      const secondPart = parts[1]?.trim();
      if (firstPart && secondPart) {
        const parsedQty = parseInt(firstPart, 10);
        if (!isNaN(parsedQty) && parsedQty > 0) {
          qtyToInsert = parsedQty;
          codeToSearch = secondPart;
        }
      }
    }

    const clean = codeToSearch.replace(/\s/g, "").toLowerCase();
    const actives = products.filter((p) => p.active !== false);

    const byBarcode = actives.find(
      (p) => (p.barcode ?? "").replace(/\s/g, "").toLowerCase() === clean,
    );
    const byName =
      byBarcode ??
      actives.find((p) => p.name.toLowerCase() === codeToSearch.toLowerCase()) ??
      actives.find((p) => p.name.toLowerCase().startsWith(codeToSearch.toLowerCase()));

    if (byName) {
      addLine(byName.name, Number(byName.price), qtyToInsert);
      toast.success(`${qtyToInsert > 1 ? `${qtyToInsert}x ` : ""}${byName.name} — ${formatBRL(Number(byName.price) * qtyToInsert)}`);
      setCode("");
      codeRef.current?.focus();
      return;
    }

    // Se for valor direto (ex: digitou 15,50)
    const directPrice = parseAmount(codeToSearch);
    if (directPrice > 0 && /^\d+([.,]\d{1,2})?$/.test(codeToSearch)) {
      addLine("Item Avulso", directPrice, qtyToInsert);
      toast.success(`${qtyToInsert > 1 ? `${qtyToInsert}x ` : ""}Item Avulso — ${formatBRL(directPrice * qtyToInsert)}`);
      setCode("");
      codeRef.current?.focus();
      return;
    }

    toast.error(`"${codeToSearch}" não encontrado.`, {
      description: "Pressione F2 para lançar como avulso ou cadastre em Produtos.",
      action: {
        label: "Cadastrar",
        onClick: () => navigate({ to: "/produtos" }),
      },
    });
    setCode("");
    codeRef.current?.focus();
  }

  // Inserir item avulso
  function handleAddFreeItem(e: React.FormEvent) {
    e.preventDefault();
    const name = freeName.trim() || "Item Avulso";
    const price = parseAmount(freePrice);
    if (price <= 0) {
      toast.error("Informe um valor válido em reais.");
      return;
    }

    addLine(name, price, 1, freeNote.trim() || undefined);
    toast.success(`${name} adicionado — ${formatBRL(price)}`);
    setFreeName("");
    setFreePrice("");
    setFreeNote("");
    setFreeOpen(false);
    codeRef.current?.focus();
  }

  // Inserir item pesado por kg (Mercado)
  function handleAddWeighedItem(e: React.FormEvent) {
    e.preventDefault();
    const pricePerKg = parseAmount(scalePriceKg);
    const grams = parseFloat(scaleGrams.replace(",", "."));
    if (pricePerKg <= 0 || isNaN(grams) || grams <= 0) {
      toast.error("Informe o preço por kg e o peso em gramas.");
      return;
    }
    const weightInKg = grams / 1000;
    const calculatedPrice = Math.round(pricePerKg * weightInKg * 100) / 100;
    const itemName = scaleItemName.trim() || "Hortifrúti / Frios";
    addLine(`${itemName} (${grams}g)`, calculatedPrice);
    setScaleModalOpen(false);
    setScaleItemName("");
    setScalePriceKg("");
    setScaleGrams("");
    toast.success(`${itemName} (${grams}g) — ${formatBRL(calculatedPrice)}`);
    codeRef.current?.focus();
  }

  // Gerenciador Global de Teclas de Atalho (100% sem mouse)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const isFKey = event.key.startsWith("F") && !isNaN(Number(event.key.slice(1)));

      // Atalho: Foco no Leitor de Código de Barras (F1 padrão)
      if (matchesKey(event, shortcutsConfig.focus_barcode)) {
        event.preventDefault();
        codeRef.current?.focus();
        codeRef.current?.select();
        return;
      }

      // Atalho: Item Avulso (F2 padrão)
      if (matchesKey(event, shortcutsConfig.open_free_item)) {
        event.preventDefault();
        setFreeOpen(true);
        setTimeout(() => freeNameRef.current?.focus(), 60);
        return;
      }

      // Atalho: Balança / Pesar Kg (F3 padrão)
      if (matchesKey(event, shortcutsConfig.open_weigh)) {
        event.preventDefault();
        setScaleModalOpen(true);
        return;
      }

      // Atalho: Finalizar Venda (F4 ou F8 padrão)
      if (matchesKey(event, shortcutsConfig.checkout) || event.key === "F8") {
        event.preventDefault();
        if (lines.length && !busy) void checkout();
        return;
      }

      // Atalho: Limpar Carrinho (F8 ou F9 padrão)
      if (matchesKey(event, shortcutsConfig.clear_cart) || event.key === "F9") {
        if (!isInputFocused || isFKey) {
          event.preventDefault();
          if (lines.length) {
            setLines([]);
            toast.info("Carrinho esvaziado.");
          }
          codeRef.current?.focus();
          return;
        }
      }

      // Atalho: Abrir Consulta de Atalhos (F9 ou F10 padrão)
      if (matchesKey(event, shortcutsConfig.open_shortcuts) || event.key === "F10") {
        event.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      // Esc: Fechar modais / limpar foco e voltar ao leitor
      if (event.key === "Escape") {
        setFreeOpen(false);
        setScaleModalOpen(false);
        setShortcutsModalOpen(false);
        setWishlistOpen(false);
        codeRef.current?.focus();
        return;
      }

      // Atalhos de Seleção de Pagamento: 1, 2, 3, 4 ou Alt+1..4
      if (
        event.altKey &&
        ["1", "2", "3", "4"].includes(event.key)
      ) {
        event.preventDefault();
        const map: Record<string, string> = {
          "1": "pix",
          "2": "dinheiro",
          "3": "credito",
          "4": "debito",
        };
        const selected = map[event.key];
        if (selected) {
          setMethod(selected);
          toast.info(`Pagamento: ${selected.toUpperCase()}`);
        }
        return;
      }

      // Teclas 1, 2, 3, 4 diretas (quando fora de inputs)
      if (!isInputFocused && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const map: Record<string, string> = {
          "1": "pix",
          "2": "dinheiro",
          "3": "credito",
          "4": "debito",
        };
        const selected = map[event.key];
        if (selected) {
          setMethod(selected);
          toast.info(`Pagamento: ${selected.toUpperCase()}`);
        }
        return;
      }

      // Atalhos de Seleção de Desconto (Moda): Alt+0, Alt+5, Alt+1, Alt+2, Alt+3
      if (event.altKey && currentBranch === "moda") {
        if (event.key === "0") {
          event.preventDefault();
          setDiscountPercent(0);
          toast.info("Desconto: 0%");
        } else if (event.key === "5") {
          event.preventDefault();
          setDiscountPercent(5);
          toast.info("Desconto: 5% aplicado");
        } else if (event.key === "1") {
          event.preventDefault();
          setDiscountPercent(10);
          toast.info("Desconto: 10% aplicado");
        } else if (event.key === "2") {
          event.preventDefault();
          setDiscountPercent(15);
          toast.info("Desconto: 15% aplicado");
        } else if (event.key === "3") {
          event.preventDefault();
          setDiscountPercent(20);
          toast.info("Desconto: 20% aplicado");
        }
      }

      // Tecla + ou - no campo de código vazio: altera quantidade do último item adicionado
      if (isInputFocused && target === codeRef.current && !code.trim() && lines.length > 0) {
        const lastItem = lines[lines.length - 1];
        if (lastItem) {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            changeQty(lastItem.key, 1);
            return;
          }
          if (event.key === "-") {
            event.preventDefault();
            changeQty(lastItem.key, -1);
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutsConfig, lines, total, busy, currentBranch, code]);

  async function checkout() {
    if (!profile) return;
    if (total <= 0) {
      toast.error("Adicione itens ao carrinho para finalizar.");
      codeRef.current?.focus();
      return;
    }
    if (method === "pix" && !profile.pix_key) {
      toast.error("Cadastre sua chave Pix em Configurações para gerar a cobrança.");
      return;
    }

    setBusy(true);
    try {
      const items: OrderItem[] = lines.map(({ name, qty, price, note }) => ({
        name: note ? `${name} [${note}]` : name,
        qty,
        price,
      }));

      const parts: string[] = [];
      if (currentBranch === "restaurante" && tableNumber.trim()) {
        parts.push(`Mesa/Comanda: ${tableNumber.trim()}`);
      }
      if (currentBranch === "servicos" && technicianName.trim()) {
        parts.push(`Técnico: ${technicianName.trim()}`);
      }
      if (discountPercent > 0) {
        parts.push(`Desc. ${discountPercent}%`);
      }
      parts.push(items.map((i) => `${i.qty}x ${i.name}`).join(", "));
      const description = parts.join(" | ").slice(0, 150);

      if (isGuest) {
        const number = nextLocalOrderNumber();
        const now = new Date().toISOString();
        const order: Order = {
          id: `local-${number}`,
          user_id: "local",
          order_number: number,
          customer_name: customer.trim() || (tableNumber ? `Mesa ${tableNumber}` : "Cliente"),
          customer_contact: null,
          description,
          items,
          amount: total,
          status: "aberto",
          payment_method: method,
          pix_payload:
            method === "pix" && profile.pix_key
              ? buildPixPayload({
                  key: profile.pix_key,
                  keyType: profile.pix_key_type,
                  merchantName: profile.merchant_name || profile.store_name,
                  city: profile.city,
                  amount: total,
                  txid: `PED${String(number).padStart(5, "0")}`,
                  description,
                })
              : null,
          notes: null,
          due_date: null,
          paid_at: null,
          created_at: now,
          updated_at: now,
        };
        setResult(order);
        setLines([]);
        setCustomer("");
        setDiscountPercent(0);
        return;
      }

      const { data: created, error } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          customer_name: customer.trim() || (tableNumber ? `Mesa ${tableNumber}` : "Cliente"),
          description,
          items: items as unknown as never,
          amount: total,
          payment_method: method,
          status: "aberto",
        })
        .select("id, order_number")
        .single();
      if (error) throw error;

      if (method === "pix" && profile.pix_key) {
        const payload = buildPixPayload({
          key: profile.pix_key,
          keyType: profile.pix_key_type,
          merchantName: profile.merchant_name || profile.store_name,
          city: profile.city,
          amount: total,
          txid: `PED${String(created.order_number).padStart(5, "0")}`,
          description,
        });
        await supabase.from("orders").update({ pix_payload: payload }).eq("id", created.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      setLines([]);
      setCustomer("");
      setDiscountPercent(0);
      navigate({ to: "/pedidos/$id", params: { id: created.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar a venda.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) toast.error("Não foi possível entrar com o Google.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Header Minimalista: Identidade da loja e Link para Configurações */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
          {/* Dados da Loja & Atalho para Configurações do Ramo */}
          <div className="flex items-center gap-3">
            {profile?.store_logo_url ? (
              <img
                src={profile.store_logo_url}
                alt={profile.store_name}
                className="size-8 rounded-lg border border-border/60 object-cover"
              />
            ) : (
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
                {profile?.store_name?.slice(0, 1).toUpperCase() || "L"}
              </span>
            )}

            <div>
              <span className="font-semibold text-sm leading-tight block">
                {profile?.store_name ?? "PDV Rápido"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Terminal de Vendas
              </span>
            </div>

            {/* Ramo com indicação clara para ir às Configurações (não é aba no PDV) */}
            <div className="ml-2 pl-3 border-l border-border/50">
              <Link
                to="/configuracoes"
                className="group inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-secondary/30 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 hover:border-border transition-colors"
                title="Para trocar o ramo de atuação, acesse as Configurações da loja"
              >
                <span>{branchConfig.icon}</span>
                <span className="font-medium text-foreground">{branchConfig.label}</span>
                <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                  · Alterar em Configurações
                </span>
                <Settings className="size-3 text-muted-foreground group-hover:text-foreground" />
              </Link>
            </div>
          </div>

          {/* Ações Rápidas do Header */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWishlistOpen(true)}
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
            >
              <Lightbulb className="size-3.5 text-amber-400" />
              <span className="hidden sm:inline">Desejos</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
            >
              <Link to="/produtos">
                <Package className="size-3.5" />
                <span className="hidden sm:inline">Produtos</span>
              </Link>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShortcutsModalOpen(true)}
              className="text-xs h-7 gap-1 px-2 border-border/60"
            >
              <Keyboard className="size-3 text-primary" />
              <span className="font-mono text-[10px] text-muted-foreground">F10</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Corpo Principal do PDV */}
      <main className="mx-auto max-w-7xl px-4 pt-4">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
          {/* Coluna Esquerda: Terminal de Inserção Contínua & Tabela de Itens */}
          <section className="space-y-4">
            {/* Barra Principal de Inserção Contínua (Sem seleção de produtos) */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm shadow-xs">
              <form onSubmit={submitCode} className="space-y-2.5">
                <div className="relative flex items-center">
                  <Barcode className="absolute left-3 size-5 text-muted-foreground" />
                  <Input
                    ref={codeRef}
                    className="h-12 pl-11 pr-24 text-sm sm:text-base font-mono bg-background/80 border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder="Bipe o código de barras ou digite o código/nome e tecle Enter..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      {shortcutsConfig.focus_barcode || "F1"}
                    </kbd>
                    <Button type="submit" size="sm" className="h-8 px-2.5 text-xs">
                      Inserir
                    </Button>
                  </div>
                </div>

                {/* Linha de Funções Rápidas por Teclado */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={freeOpen ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setFreeOpen(!freeOpen);
                        if (!freeOpen) setTimeout(() => freeNameRef.current?.focus(), 60);
                      }}
                      className="h-7 text-xs gap-1.5 border-border/60"
                    >
                      <Plus className="size-3.5" />
                      <span>Item Avulso</span>
                      <kbd className="rounded bg-muted/60 px-1 text-[10px] font-mono">
                        {shortcutsConfig.open_free_item || "F2"}
                      </kbd>
                    </Button>

                    {currentBranch === "mercado" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setScaleModalOpen(true)}
                        className="h-7 text-xs gap-1.5 border-border/60"
                      >
                        <Scale className="size-3.5 text-emerald-400" />
                        <span>Pesar por Kg</span>
                        <kbd className="rounded bg-muted/60 px-1 text-[10px] font-mono">
                          {shortcutsConfig.open_weigh || "F3"}
                        </kbd>
                      </Button>
                    ) : null}
                  </div>

                  <span className="text-[11px] text-muted-foreground/80 hidden md:inline">
                    Multiplicador: digite <code className="font-mono text-foreground">3*código</code> ou <code className="font-mono text-foreground">2*15.00</code>
                  </span>
                </div>
              </form>

              {/* Inserção de Item Avulso Inline (sem sair do teclado) */}
              {freeOpen ? (
                <form
                  onSubmit={handleAddFreeItem}
                  className="mt-3 rounded-lg border border-primary/20 bg-secondary/30 p-3 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Tag className="size-3.5" /> Inserção Rápida de Item Avulso
                    </span>
                    <button
                      type="button"
                      onClick={() => setFreeOpen(false)}
                      className="text-muted-foreground hover:text-foreground text-xs"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
                    <Input
                      ref={freeNameRef}
                      className="h-8 text-xs bg-background"
                      placeholder="Descrição do item ou serviço"
                      value={freeName}
                      onChange={(e) => setFreeName(e.target.value)}
                    />
                    <Input
                      className="h-8 text-xs font-mono bg-background"
                      inputMode="decimal"
                      placeholder="Valor (R$)"
                      value={freePrice}
                      onChange={(e) => setFreePrice(e.target.value)}
                    />
                    <Input
                      className="h-8 text-xs bg-background"
                      placeholder="Observação (opcional)"
                      value={freeNote}
                      onChange={(e) => setFreeNote(e.target.value)}
                    />
                    <Button type="submit" size="sm" className="h-8 text-xs">
                      Lançar
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>

            {/* Campos Específicos por Ramo (Minimalistas) */}
            {currentBranch === "restaurante" ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-3">
                <ChefHat className="size-4 text-amber-400 shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <Label className="text-xs shrink-0 font-medium text-amber-300">Mesa / Comanda:</Label>
                  <Input
                    placeholder="Ex: Mesa 04 ou Comanda 12"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="h-8 text-xs max-w-xs bg-background/60"
                  />
                </div>
              </div>
            ) : null}

            {currentBranch === "servicos" ? (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 flex items-center gap-3">
                <Wrench className="size-4 text-blue-400 shrink-0" />
                <div className="flex-1 flex items-center gap-2">
                  <Label className="text-xs shrink-0 font-medium text-blue-300">Técnico / Atendente:</Label>
                  <Input
                    placeholder="Ex: Carlos Mecânica / Maria Manicure"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    className="h-8 text-xs max-w-xs bg-background/60"
                  />
                </div>
              </div>
            ) : null}

            {/* Tabela Minimalista de Itens do Cupom */}
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-foreground">
                  Itens Lançados ({qtyCount})
                </span>
                <span className="text-[11px]">
                  Use <code className="font-mono text-foreground">+</code> / <code className="font-mono text-foreground">-</code> para ajustar quantidade
                </span>
              </div>

              {lines.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Barcode className="mx-auto size-10 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Nenhum produto inserido no caixa.
                  </p>
                  <p className="text-xs text-muted-foreground/80">
                    Bipe com o leitor ou tecle <kbd className="font-mono text-foreground">{shortcutsConfig.focus_barcode || "F1"}</kbd> para focar no campo.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
                  {lines.map((line, index) => (
                    <div
                      key={line.key}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium leading-tight truncate">
                          {line.name}
                        </p>
                        {line.note ? (
                          <p className="text-[11px] text-amber-400 mt-0.5">Obs: {line.note}</p>
                        ) : null}
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {line.qty} × {formatBRL(line.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={() => changeQty(line.key, -1)}
                          title="Diminuir quantidade"
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="font-mono text-xs font-semibold w-6 text-center">
                          {line.qty}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          onClick={() => changeQty(line.key, 1)}
                          title="Aumentar quantidade"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>

                      <span className="w-24 text-right font-mono text-xs sm:text-sm font-bold">
                        {formatBRL(line.qty * line.price)}
                      </span>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLine(line.key)}
                        title="Remover item"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Configurações Locais de Visitante (Discreta, sem poluição) */}
            {isGuest ? (
              <PixSetupPanel
                settings={settings}
                onSave={(values) => {
                  const saved = saveLocalSettings(values);
                  setSettings(saved);
                }}
              />
            ) : null}
          </section>

          {/* Coluna Direita: Resumo Financeiro & Fechamento Minimalista */}
          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm space-y-4">
              {/* Display do Total da Venda */}
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total a Pagar</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {qtyCount} {qtyCount === 1 ? "item" : "itens"}
                  </Badge>
                </div>

                <div className="font-mono text-3xl font-bold tracking-tight text-primary">
                  {formatBRL(total)}
                </div>

                {discountPercent > 0 ? (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                    <span>Subtotal: {formatBRL(subtotal)}</span>
                    <span className="text-pink-400">-{discountPercent}% ({formatBRL(discountValue)})</span>
                  </div>
                ) : null}
              </div>

              {/* Seletor de Desconto (Moda / Varejo com atalhos de teclado) */}
              {currentBranch === "moda" ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-pink-400">
                      <Percent className="size-3.5" /> Desconto Balcão
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {DISCOUNT_OPTIONS.map((opt) => (
                      <button
                        key={opt.pct}
                        type="button"
                        onClick={() => setDiscountPercent(opt.pct)}
                        className={`flex flex-col items-center justify-center rounded-md border py-1.5 text-xs font-medium transition-colors ${
                          discountPercent === opt.pct
                            ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                            : "border-border/50 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[9px] opacity-70 font-mono">{opt.hotkey}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Seletor de Forma de Pagamento com Teclas de Atalho [1] [2] [3] [4] */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Forma de Pagamento</span>
                  <span className="text-[10px] font-mono">Teclas [1] a [4]</span>
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {PAYMENT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isSelected = method === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setMethod(opt.id)}
                        className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary/40 shadow-xs"
                            : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon className="size-3.5 shrink-0" />
                          <span className="truncate">{opt.label}</span>
                        </div>
                        <kbd className="rounded border border-border/60 bg-muted/80 px-1 py-0.2 text-[10px] font-mono">
                          {opt.hotkey}
                        </kbd>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Identificação Opcional do Cliente */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Cliente (opcional)</Label>
                <Input
                  className="h-8 text-xs bg-background/60"
                  placeholder="Nome do cliente no comprovante"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>

              {/* Botões de Ação Final */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Button
                  className="w-full h-11 text-sm font-semibold tracking-wide justify-between"
                  disabled={busy || !lines.length}
                  onClick={checkout}
                >
                  {busy ? (
                    <span className="flex items-center gap-2 mx-auto">
                      <Loader2 className="size-4 animate-spin" /> Gerando cobrança...
                    </span>
                  ) : (
                    <>
                      <span>Finalizar Venda</span>
                      <kbd className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[11px]">
                        {shortcutsConfig.checkout || "F4 / F8"}
                      </kbd>
                    </>
                  )}
                </Button>

                {lines.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground hover:text-destructive justify-between"
                    onClick={() => {
                      setLines([]);
                      toast.info("Carrinho esvaziado.");
                      codeRef.current?.focus();
                    }}
                  >
                    <span>Limpar Carrinho</span>
                    <kbd className="font-mono text-[10px]">
                      {shortcutsConfig.clear_cart || "F9"}
                    </kbd>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Resultado de Cobrança Pix para Visitante */}
            {result && profile ? (
              <GuestResult
                order={result}
                profile={profile}
                onClose={() => {
                  setResult(null);
                  codeRef.current?.focus();
                }}
                onSignIn={signInWithGoogle}
              />
            ) : null}
          </aside>
        </div>
      </main>

      {/* Modal de Balança / Pesagem (Mercado) */}
      <Dialog open={scaleModalOpen} onOpenChange={setScaleModalOpen}>
        <DialogContent className="max-w-sm p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Scale className="size-4 text-emerald-400" /> Pesar Item por Kg
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe o valor do kg e o peso em gramas aferido na balança
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddWeighedItem} className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Nome do produto</Label>
              <Input
                placeholder="Ex: Tomate / Queijo Prato"
                value={scaleItemName}
                onChange={(e) => setScaleItemName(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Preço / Kg (R$)</Label>
                <Input
                  placeholder="Ex: 8,90"
                  value={scalePriceKg}
                  onChange={(e) => setScalePriceKg(e.target.value)}
                  className="h-8 text-xs font-mono"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Peso (gramas)</Label>
                <Input
                  placeholder="Ex: 450"
                  value={scaleGrams}
                  onChange={(e) => setScaleGrams(e.target.value)}
                  className="h-8 text-xs font-mono"
                  inputMode="numeric"
                />
              </div>
            </div>

            {parseAmount(scalePriceKg) > 0 && parseFloat(scaleGrams) > 0 ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-center text-xs font-mono text-emerald-400 font-bold">
                Total calculado: {formatBRL(Math.round(parseAmount(scalePriceKg) * (parseFloat(scaleGrams) / 1000) * 100) / 100)}
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setScaleModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                Adicionar [Enter]
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Atalhos de Teclado */}
      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
        onConfigChange={() => setShortcutsConfig(loadShortcutsConfig())}
      />

      {/* Central de Desejos de Layout & Funções */}
      <BranchWishlistModal
        open={wishlistOpen}
        onOpenChange={setWishlistOpen}
        defaultBranch={currentBranch}
      />
    </div>
  );
}

function PixSetupPanel({
  settings,
  onSave,
}: {
  settings: LocalSettings;
  onSave: (values: Partial<LocalSettings>) => void;
}) {
  const [form, setForm] = useState(settings);
  const [open, setOpen] = useState(false);

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-xl border border-border/50 bg-card/30 p-3 text-xs"
    >
      <summary className="flex cursor-pointer select-none items-center justify-between font-medium text-muted-foreground hover:text-foreground">
        <span className="flex items-center gap-2">
          <Settings className="size-3.5" />
          Dados da loja neste navegador (Visitante)
        </span>
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>

      <div className="grid gap-3 pt-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px]">Nome da loja</Label>
          <Input
            className="h-8 text-xs"
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">Chave Pix</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={form.pix_key ?? ""}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
            placeholder="Chave para receber pagamentos"
          />
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() => {
              onSave(form);
              toast.success("Dados locais atualizados!");
            }}
          >
            Salvar dados locais
          </Button>
        </div>
      </div>
    </details>
  );
}

function GuestResult({
  order,
  profile,
  onClose,
  onSignIn,
}: {
  order: Order;
  profile: Profile;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const qr = usePixQr(order.pix_payload);

  async function saveImage(mode: "cobranca" | "recibo") {
    const dataUrl = await buildReceiptImage({ order, profile, mode, qrDataUrl: qr });
    downloadDataUrl(dataUrl, `${mode}-${order.order_number}.png`);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <h2 className="font-semibold text-xs">
          Venda nº {String(order.order_number).padStart(4, "0")} Gerada
        </h2>
        <Button size="icon" variant="ghost" className="size-6 text-muted-foreground" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {order.pix_payload ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <PixQr payload={order.pix_payload} className="size-40 rounded-lg bg-white p-2.5 shadow-sm" />
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1"
            onClick={() => {
              navigator.clipboard.writeText(order.pix_payload ?? "");
              toast.success("Pix copia e cola copiado!");
            }}
          >
            <Copy className="size-3" /> Copiar Pix
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <Button
          size="sm"
          variant="secondary"
          className="text-xs h-8 gap-1"
          onClick={() =>
            printReceipt({ order, profile, mode: "cobranca", layout: "a4", qrDataUrl: qr })
          }
        >
          <Printer className="size-3" /> Imprimir A4
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="text-xs h-8 gap-1"
          onClick={() =>
            printReceipt({ order, profile, mode: "cobranca", layout: "cupom", qrDataUrl: qr })
          }
        >
          <Printer className="size-3" /> Cupom 80mm
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => saveImage("cobranca")}>
          <ImageIcon className="size-3 mr-1" /> Imagem Cobrança
        </Button>
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => saveImage("recibo")}>
          <ImageIcon className="size-3 mr-1" /> Imagem Recibo
        </Button>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] text-muted-foreground space-y-1.5">
        <p>Venda salva localmente. Crie sua conta para sincronizar pedidos na nuvem.</p>
        <Button className="w-full h-7 text-xs" size="sm" onClick={onSignIn}>
          <UserPlus className="size-3 mr-1" /> Criar conta com Google
        </Button>
      </div>
    </div>
  );
}
