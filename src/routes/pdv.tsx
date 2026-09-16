import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Copy,
  Image as ImageIcon,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  Lightbulb,
  Scale,
  Percent,
  ChefHat,
  Wrench,
  Store,
  Tag,
  Loader2,
  Keyboard,
  PlusCircle,
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
import { QuickItemModal } from "@/components/QuickItemModal";
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
      { title: "PDV rápido por Ramo — Mercado, Restaurante, Moda & Serviços | Comprovante Pix" },
      {
        name: "description",
        content:
          "PDV adaptável para supermercados, restaurantes, lojas e serviços. Passe código de barras, pese por kg, comande mesas e gere cobrança Pix com recibo na hora.",
      },
      { property: "og:title", content: "PDV rápido adaptável por ramo com Pix" },
      {
        property: "og:description",
        content: "PDV para mercado, restaurante e varejo com código de barras, pesagem, mesas e QR Code Pix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdvPage,
});

interface CartLine extends OrderItem {
  key: string;
  note?: string;
}

function getCategoryEmoji(category: string | null | undefined): string {
  if (!category) return "📦";
  const c = category.toLowerCase();
  if (c.includes("carne") || c.includes("acougue") || c.includes("frango") || c.includes("boi")) return "🥩";
  if (c.includes("bebid") || c.includes("suco") || c.includes("refri") || c.includes("cervej") || c.includes("agua")) return "🥤";
  if (c.includes("padar") || c.includes("pao") || c.includes("bolo") || c.includes("frio") || c.includes("queijo")) return "🥖";
  if (c.includes("horti") || c.includes("fruta") || c.includes("verd") || c.includes("flv") || c.includes("legum")) return "🍎";
  if (c.includes("limp") || c.includes("higiene") || c.includes("sabao") || c.includes("deterg")) return "🧼";
  if (c.includes("lanche") || c.includes("burg") || c.includes("pizza") || c.includes("salgad")) return "🍔";
  if (c.includes("doce") || c.includes("sobrem") || c.includes("choc")) return "🍰";
  if (c.includes("roup") || c.includes("moda") || c.includes("camis") || c.includes("vest")) return "👗";
  if (c.includes("calc") || c.includes("tenis") || c.includes("sapat")) return "👟";
  if (c.includes("peca") || c.includes("oleo") || c.includes("motor") || c.includes("ferram")) return "⚙️";
  if (c.includes("serv") || c.includes("mao") || c.includes("repar") || c.includes("laudo")) return "🔧";
  return "🏷️";
}

function PdvPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;
  const { data: remoteProfile } = useProfile();
  const { data: products = [], isLoading: productsLoading } = useProducts();

  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const profile: Profile | null = isGuest ? localProfile(settings) : (remoteProfile ?? null);

  // Ramo ativo do PDV
  const [currentBranch, setCurrentBranch] = useState<BusinessBranch>(
    (settings.business_branch as BusinessBranch) || "mercado",
  );

  // Atalhos de teclado
  const [shortcutsConfig, setShortcutsConfig] = useState<Record<ShortcutActionId, string>>(() =>
    loadShortcutsConfig(),
  );
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Modais
  const [wishlistOpen, setWishlistOpen] = useState(false);
  const [quickItemOpen, setQuickItemOpen] = useState(false);
  const [scaleModalOpen, setScaleModalOpen] = useState(false);

  // Modal de Pesagem (Mercado)
  const [scaleItemName, setScaleItemName] = useState("");
  const [scalePriceKg, setScalePriceKg] = useState("");
  const [scaleGrams, setScaleGrams] = useState("");

  // Campos específicos de ramos
  const [tableNumber, setTableNumber] = useState(""); // Restaurante
  const [technicianName, setTechnicianName] = useState(""); // Serviços
  const [discountPercent, setDiscountPercent] = useState<number>(0); // Moda / Varejo

  // Filtro de categoria selecionada
  const [selectedCategory, setSelectedCategory] = useState<string>("todas");

  const [code, setCode] = useState("");
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);

  const subtotal = lines.reduce((acc, line) => acc + line.qty * line.price, 0);
  const discountValue = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal - discountValue);
  const qtyCount = lines.reduce((acc, line) => acc + line.qty, 0);

  const branchConfig = BUSINESS_BRANCHES[currentBranch] ?? BUSINESS_BRANCHES.mercado;

  // Atualizar ramo e salvar nas configurações locais
  function handleBranchChange(next: BusinessBranch) {
    setCurrentBranch(next);
    const updated = saveLocalSettings({ business_branch: next });
    setSettings(updated);
    setSelectedCategory("todas");
    toast.info(`Layout adaptado para: ${BUSINESS_BRANCHES[next].label}`, {
      icon: BUSINESS_BRANCHES[next].icon,
    });
  }

  // Listener Global de Atalhos de Teclado
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Se estiver digitando em input/textarea, não interceptar a menos que seja tecla de função (F1..F12)
      const target = event.target as HTMLElement | null;
      const isInputFocused =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      const isFKey = event.key.startsWith("F") && !isNaN(Number(event.key.slice(1)));

      if (matchesKey(event, shortcutsConfig.focus_barcode)) {
        event.preventDefault();
        codeRef.current?.focus();
        codeRef.current?.select();
        return;
      }

      if (matchesKey(event, shortcutsConfig.open_free_item)) {
        event.preventDefault();
        setQuickItemOpen(true);
        return;
      }

      if (matchesKey(event, shortcutsConfig.open_weigh)) {
        event.preventDefault();
        setScaleModalOpen(true);
        return;
      }

      if (matchesKey(event, shortcutsConfig.checkout)) {
        event.preventDefault();
        checkout();
        return;
      }

      if (matchesKey(event, shortcutsConfig.clear_cart)) {
        if (!isInputFocused || isFKey) {
          event.preventDefault();
          if (lines.length) {
            setLines([]);
            toast.info("Carrinho esvaziado.");
          }
          return;
        }
      }

      if (matchesKey(event, shortcutsConfig.open_shortcuts)) {
        event.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutsConfig, lines, total, busy, profile, method, customer, currentBranch, tableNumber, technicianName, discountPercent]);

  // Obter lista única de categorias presentes nos produtos cadastrados
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products]);

  const visible = useMemo(() => {
    const search = term.trim().toLowerCase();
    return products
      .filter((p) => p.active !== false)
      .filter((p) => {
        if (selectedCategory !== "todas") {
          return p.category?.toLowerCase() === selectedCategory.toLowerCase();
        }
        return true;
      })
      .filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search) ||
          (p.barcode ?? "").includes(search) ||
          (p.category ?? "").toLowerCase().includes(search),
      )
      .slice(0, 32);
  }, [products, term, selectedCategory]);

  function addLine(name: string, price: number, note?: string) {
    setLines((current) => {
      const found = current.find((l) => l.name === name && l.price === price && l.note === note);
      if (found) {
        return current.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...current, { key: `${name}-${Date.now()}`, name, qty: 1, price, note }];
    });
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    const product = products.find(
      (p) => (p.barcode ?? "").replace(/\s/g, "") === value.replace(/\s/g, ""),
    );
    if (product) {
      addLine(product.name, Number(product.price));
      setCode("");
      codeRef.current?.focus();
      return;
    }
    toast.error(`Código ${value} não cadastrado.`, {
      action: { label: "Cadastrar", onClick: () => navigate({ to: "/produtos" }) },
    });
    setCode("");
  }

  function changeQty(key: string, delta: number) {
    setLines((current) =>
      current
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function handleAddWeighedItem(e: React.FormEvent) {
    e.preventDefault();
    const pricePerKg = parseAmount(scalePriceKg);
    const grams = parseFloat(scaleGrams.replace(",", "."));
    if (pricePerKg <= 0 || isNaN(grams) || grams <= 0) {
      toast.error("Informe o preço por quilo e o peso válido em gramas.");
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
    toast.success(`Adicionado: ${itemName} — ${formatBRL(calculatedPrice)}`);
  }

  async function checkout() {
    if (!profile) return;
    if (total <= 0) {
      toast.error("Adicione itens ao carrinho.");
      return;
    }
    if (method === "pix" && !profile.pix_key) {
      toast.error("Cadastre sua chave Pix para gerar o QR Code.");
      return;
    }

    setBusy(true);
    try {
      const items: OrderItem[] = lines.map(({ name, qty, price, note }) => ({
        name: note ? `${name} [${note}]` : name,
        qty,
        price,
      }));

      // Montar descrição com dados do ramo
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
      toast.error(error instanceof Error ? error.message : "Não foi possível finalizar.");
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
    <div className="min-h-screen bg-background pb-20 lg:pb-6">
      {/* Header Principal — Sem link de redirecionamento na Logo para garantir o sistema */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo e Nome da Loja — Não navega para início do site */}
          <div className="flex items-center gap-3 select-none cursor-default">
            {profile?.store_logo_url ? (
              <img
                src={profile.store_logo_url}
                alt={profile.store_name}
                className="size-9 rounded-xl border border-border object-cover bg-background"
              />
            ) : (
              <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground shadow-sm">
                {profile?.store_name?.slice(0, 1).toUpperCase() || "C"}
              </span>
            )}
            <div className="flex flex-col">
              <span className="font-display text-base font-semibold leading-tight sm:text-lg">
                {profile?.store_name ?? "PDV Rápido"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Caixa aberto · {branchConfig.label}
              </span>
            </div>

            {/* Seletor de Ramo do Negócio direto na tela */}
            <Select
              value={currentBranch}
              onValueChange={(val) => handleBranchChange(val as BusinessBranch)}
            >
              <SelectTrigger className="h-8 w-auto gap-1.5 border-border/80 bg-secondary/50 px-2.5 text-xs font-medium hover:bg-secondary">
                <span className="text-sm">{branchConfig.icon}</span>
                <SelectValue placeholder="Ramo" />
              </SelectTrigger>
              <SelectContent align="start" className="w-56">
                <div className="p-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Trocar Nicho do PDV
                </div>
                {Object.values(BUSINESS_BRANCHES).map((branch) => (
                  <SelectItem key={branch.id} value={branch.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{branch.icon}</span>
                      <span className="font-medium">{branch.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-2">
            {/* Botão de Central de Desejos */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWishlistOpen(true)}
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 text-xs h-8"
            >
              <Lightbulb className="size-3.5" />
              <span className="hidden sm:inline">Desejar layout/função</span>
              <span className="sm:hidden">Desejar</span>
            </Button>

            <Button variant="ghost" size="sm" asChild className="hidden sm:flex h-8 text-xs">
              <Link to="/produtos">
                <Package className="size-3.5" /> Produtos
              </Link>
            </Button>

            {isGuest ? (
              <Button size="sm" onClick={signInWithGoogle} className="text-xs h-8">
                <UserPlus className="size-3.5" /> Salvar no Google
              </Button>
            ) : (
              <Button variant="secondary" size="sm" asChild className="text-xs h-8">
                <Link to="/pedidos">Meus pedidos</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Banner do Ramo com Tagline */}
        <div className="border-t border-border/60 bg-secondary/30 px-4 py-1.5">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${branchConfig.badgeColor}`}>
                Modo {branchConfig.label.split(" ")[0]}
              </Badge>
              <span className="hidden md:inline">{branchConfig.tagline}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShortcutsModalOpen(true)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Keyboard className="size-3 text-primary" />
                <span className="hidden sm:inline">Atalhos:</span>
                <kbd className="rounded bg-secondary/80 px-1 py-0.5 font-mono text-[10px]">
                  {shortcutsConfig.focus_barcode} Bipar
                </kbd>
                <kbd className="rounded bg-secondary/80 px-1 py-0.5 font-mono text-[10px]">
                  {shortcutsConfig.open_free_item} Avulso
                </kbd>
                <kbd className="rounded bg-secondary/80 px-1 py-0.5 font-mono text-[10px]">
                  {shortcutsConfig.checkout} Finalizar
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 lg:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          {/* Barra de Código de Barras + Botão de Item Avulso + Pesagem */}
          <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={submitCode} className="panel flex flex-1 items-center gap-2 p-2.5 min-w-[260px]">
              <Barcode className="size-5 shrink-0 text-primary" />
              <Input
                ref={codeRef}
                autoFocus
                className="h-10 flex-1 text-base border-0 focus-visible:ring-0 bg-transparent px-2"
                inputMode="numeric"
                placeholder={
                  currentBranch === "mercado"
                    ? `Passe o leitor ou digite o código (${shortcutsConfig.focus_barcode})`
                    : `Código de barras (${shortcutsConfig.focus_barcode})`
                }
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" size="sm" className="h-9 px-3.5">
                Bipar
              </Button>
            </form>

            {/* Botão de Incluir Item Avulso sem cadastro (limpo, com atalho) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuickItemOpen(true)}
              className="h-[52px] gap-1.5 border-border bg-secondary/40 hover:bg-secondary text-xs px-3.5"
            >
              <PlusCircle className="size-4 text-primary" />
              <div className="flex flex-col items-start leading-none">
                <span className="font-semibold text-foreground">Item Avulso</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {shortcutsConfig.open_free_item}
                </span>
              </div>
            </Button>

            {/* Recurso Rápido do Ramo Mercado: Balança / Pesagem */}
            {currentBranch === "mercado" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setScaleModalOpen(true)}
                className="h-[52px] gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-xs px-3.5"
              >
                <Scale className="size-4" />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-semibold">Pesar por Kg</span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {shortcutsConfig.open_weigh}
                  </span>
                </div>
              </Button>
            ) : null}
          </div>

          {/* Barra de Busca por Nome */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder={`Buscar produto pelo nome ou código...`}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {/* Chips de Categorias Dinâmicas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory("todas")}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCategory === "todas"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Todas as categorias
            </button>

            {/* Categorias rápidas do Ramo */}
            {branchConfig.quickCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.label)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === cat.label
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}

            {/* Categorias adicionais cadastradas nos produtos */}
            {allCategories.map((cat) => {
              const alreadyInQuick = branchConfig.quickCategories.some(
                (q) => q.label.toLowerCase() === cat.toLowerCase(),
              );
              if (alreadyInQuick) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>{getCategoryEmoji(cat)}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Grade de Produtos com Shimmer Loading */}
          {productsLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="panel flex h-36 flex-col justify-between p-4">
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-3/4" />
                    <div className="skeleton h-3 w-1/2" />
                  </div>
                  <div className="skeleton h-6 w-20" />
                </div>
              ))}
            </div>
          ) : visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((product) => {
                const inCartQty = lines
                  .filter((l) => l.name === product.name && l.price === Number(product.price))
                  .reduce((sum, l) => sum + l.qty, 0);

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addLine(product.name, Number(product.price))}
                    className="panel group relative flex h-full min-h-32 flex-col justify-between gap-2 p-3.5 text-left transition-all hover:border-primary/60 hover:bg-secondary/60 active:scale-[0.98]"
                  >
                    {/* Badge de quantidade no carrinho */}
                    {inCartQty > 0 ? (
                      <span className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-primary font-display text-xs font-bold text-primary-foreground shadow-md ring-2 ring-background">
                        {inCartQty}
                      </span>
                    ) : null}

                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-base">{getCategoryEmoji(product.category)}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {product.unit ? product.unit.toUpperCase() : "UN"}
                        </span>
                      </div>
                      <span className="mt-1 line-clamp-2 font-medium leading-snug text-sm">
                        {product.name}
                      </span>
                    </div>

                    <div className="flex items-end justify-between pt-1">
                      <span className="font-display text-base font-bold text-primary sm:text-lg">
                        {formatBRL(Number(product.price))}
                      </span>
                      {product.barcode ? (
                        <span className="font-mono text-[10px] text-muted-foreground/70">
                          #{product.barcode.slice(-4)}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="panel p-8 text-center text-sm text-muted-foreground">
              <Store className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 font-medium">Nenhum produto cadastrado nesta categoria.</p>
              <p className="text-xs text-muted-foreground">
                Cadastre itens com leitor de código de barras ou use o botão "+ Item Avulso ({shortcutsConfig.open_free_item})".
              </p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="outline" asChild className="text-xs">
                  <Link to="/produtos">Cadastrar Produtos</Link>
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setQuickItemOpen(true)} className="text-xs">
                  <Plus className="size-3.5 mr-1" /> Lançar Avulso
                </Button>
              </div>
            </div>
          )}

          {/* Recursos Específicos por Ramo: Mesa (Restaurante), Técnico (Serviços), Desconto (Moda) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {currentBranch === "restaurante" ? (
              <div className="panel space-y-2 p-3.5 border-amber-500/30 bg-amber-500/5 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <ChefHat className="size-4" />
                  <span>Restaurante: Identificação do Pedido</span>
                </div>
                <Input
                  placeholder="Número da Mesa ou Comanda (Ex: Mesa 04)"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            ) : null}

            {currentBranch === "servicos" ? (
              <div className="panel space-y-2 p-3.5 border-blue-500/30 bg-blue-500/5 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-300">
                  <Wrench className="size-4" />
                  <span>Serviços: Atendente / Técnico</span>
                </div>
                <Input
                  placeholder="Nome do Técnico ou Mecânico responsável"
                  value={technicianName}
                  onChange={(e) => setTechnicianName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            ) : null}

            {currentBranch === "moda" ? (
              <div className="panel space-y-2 p-3.5 border-pink-500/30 bg-pink-500/5 sm:col-span-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-pink-300">
                  <Percent className="size-4" />
                  <span>Moda / Varejo: Desconto Balcão</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <Button
                      key={pct}
                      type="button"
                      size="sm"
                      variant={discountPercent === pct ? "default" : "outline"}
                      onClick={() => setDiscountPercent(pct)}
                      className="h-8 text-xs font-semibold"
                    >
                      {pct === 0 ? "Sem desconto" : `${pct}% OFF`}
                    </Button>
                  ))}
                  {discountPercent > 0 ? (
                    <span className="text-xs text-pink-300">
                      Economia de {formatBRL(discountValue)} no total
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Configuração da loja (Visitante) com Upload de Logo e Ramo */}
          {isGuest ? (
            <PixSetupPanel
              settings={settings}
              onSave={(values) => {
                const saved = saveLocalSettings(values);
                setSettings(saved);
                if (values.business_branch) setCurrentBranch(values.business_branch);
              }}
            />
          ) : null}
        </section>

        {/* Carrinho Lateral */}
        <aside ref={cartRef} className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Carrinho</h2>
              <Badge variant="outline" className="ml-auto">
                {qtyCount} {qtyCount === 1 ? "item" : "itens"}
              </Badge>
            </div>

            <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
              {lines.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <p>Carrinho vazio.</p>
                  <p className="text-xs">Bipe um código ({shortcutsConfig.focus_barcode}) ou lance item avulso ({shortcutsConfig.open_free_item}).</p>
                </div>
              ) : (
                lines.map((line) => (
                  <div key={line.key} className="flex items-center gap-2 rounded-xl bg-secondary/50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      {line.note ? (
                        <p className="text-[11px] text-amber-300">Obs: {line.note}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {line.qty} × {formatBRL(line.price)}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => changeQty(line.key, -1)}>
                      <Minus className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => changeQty(line.key, 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                    <span className="w-20 text-right text-sm font-semibold">
                      {formatBRL(line.qty * line.price)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {discountPercent > 0 ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatBRL(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-pink-400">
                    <span>Desconto ({discountPercent}%)</span>
                    <span>- {formatBRL(discountValue)}</span>
                  </div>
                </div>
              ) : null}

              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total da Venda</span>
                <span className="font-display text-3xl font-bold text-primary">{formatBRL(total)}</span>
              </div>

              <Input
                placeholder="Nome do cliente (opcional)"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
              />

              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                className="w-full font-semibold shadow-glow"
                size="lg"
                disabled={busy || !lines.length}
                onClick={checkout}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Gerando cobrança...
                  </>
                ) : (
                  <>Finalizar venda ({shortcutsConfig.checkout})</>
                )}
              </Button>

              {lines.length ? (
                <Button
                  className="w-full text-xs text-muted-foreground"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLines([])}
                >
                  Limpar carrinho ({shortcutsConfig.clear_cart})
                </Button>
              ) : null}
            </div>
          </div>

          {result && profile ? (
            <GuestResult order={result} profile={profile} onClose={() => setResult(null)} onSignIn={signInWithGoogle} />
          ) : null}
        </aside>
      </main>

      {/* Barra Mobile Flutuante para Checkout Rápido */}
      {lines.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{qtyCount} {qtyCount === 1 ? "item" : "itens"}</p>
              <p className="font-display text-xl font-bold text-primary">{formatBRL(total)}</p>
            </div>
            <Button
              size="lg"
              className="flex-1 font-semibold"
              disabled={busy}
              onClick={() => {
                cartRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Ver Carrinho & Pagar
            </Button>
          </div>
        </div>
      ) : null}

      {/* Ícone Flutuante Discreto no Canto Inferior Direito para Consultar Atalhos */}
      <button
        type="button"
        onClick={() => setShortcutsModalOpen(true)}
        className="fixed bottom-4 right-4 z-30 flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/85 px-3 py-1.5 text-xs text-muted-foreground shadow-panel backdrop-blur transition-all hover:bg-secondary hover:text-foreground hover:scale-105"
        title="Ver atalhos de teclado do PDV"
      >
        <Keyboard className="size-3.5 text-primary" />
        <span className="font-medium text-[11px]">Atalhos ({shortcutsConfig.open_shortcuts})</span>
      </button>

      {/* Modal de Item Avulso (Substituiu a caixa de inserção rápida) */}
      <QuickItemModal
        open={quickItemOpen}
        onOpenChange={setQuickItemOpen}
        onAddItem={(name, price, note) => addLine(name, price, note)}
      />

      {/* Modal de Pesagem (Mercado) */}
      <Dialog open={scaleModalOpen} onOpenChange={setScaleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300">
                <Scale className="size-4" />
              </span>
              <DialogTitle>Pesagem por Quilo (Balança)</DialogTitle>
            </div>
            <DialogDescription>
              Informe o peso em gramas e o preço do quilo para calcular o valor na hora.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddWeighedItem} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Nome do item (ex: Banana Prata, Maçã, Queijo Prato)</Label>
              <Input
                placeholder="Ex: Banana Prata"
                value={scaleItemName}
                onChange={(e) => setScaleItemName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Preço por Kg (R$)</Label>
                <Input
                  inputMode="decimal"
                  placeholder="Ex: 8,90"
                  value={scalePriceKg}
                  onChange={(e) => setScalePriceKg(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Peso em Gramas (g)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="Ex: 450"
                  value={scaleGrams}
                  onChange={(e) => setScaleGrams(e.target.value)}
                />
              </div>
            </div>

            {scalePriceKg && scaleGrams ? (
              <div className="rounded-xl bg-secondary/50 p-3 text-center">
                <span className="text-xs text-muted-foreground">Valor calculado:</span>
                <p className="font-display text-2xl font-bold text-emerald-400">
                  {formatBRL(
                    (parseAmount(scalePriceKg) *
                      parseFloat(scaleGrams.replace(",", ".") || "0")) /
                      1000,
                  )}
                </p>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setScaleModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Adicionar ao Carrinho</Button>
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

      {/* Central de Desejos de Layout & Funções por Ramo */}
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

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Dados da Loja & Nicho (neste aparelho)</h2>
        <Badge variant="outline" className="text-[11px]">Personalização</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Nome da loja</Label>
          <Input
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label>Ramo padrão do negócio</Label>
          <Select
            value={form.business_branch ?? "mercado"}
            onValueChange={(value) =>
              setForm({ ...form, business_branch: value as BusinessBranch })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BUSINESS_BRANCHES).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.icon} {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Upload de Logo via arquivo */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Logo da Loja (enviar arquivo de imagem)</Label>
          <LogoUploader
            value={form.store_logo_url}
            onChange={(logoUrl) => setForm({ ...form, store_logo_url: logoUrl })}
          />
        </div>

        <div className="space-y-1">
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>

        <div className="space-y-1">
          <Label>Chave Pix</Label>
          <Input
            value={form.pix_key ?? ""}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
            placeholder="CPF, telefone, e-mail ou aleatória"
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label>Tipo da chave</Label>
          <Select
            value={form.pix_key_type}
            onValueChange={(value) => setForm({ ...form, pix_key_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIX_KEY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        variant="secondary"
        onClick={() => {
          onSave(form);
          toast.success("Configurações da loja e ramo atualizados!");
        }}
      >
        Salvar dados da loja
      </Button>
    </div>
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
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Venda nº {String(order.order_number).padStart(4, "0")}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      </div>

      {order.pix_payload ? (
        <div className="flex flex-col items-center gap-3">
          <PixQr payload={order.pix_payload} className="size-48 rounded-xl bg-white p-3 shadow-md" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(order.pix_payload ?? "");
              toast.success("Pix copia e cola copiado.");
            }}
          >
            <Copy className="size-4" /> Copiar Pix
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            printReceipt({ order, profile, mode: "cobranca", layout: "a4", qrDataUrl: qr })
          }
        >
          <Printer className="size-4" /> Imprimir A4
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            printReceipt({ order, profile, mode: "cobranca", layout: "cupom", qrDataUrl: qr })
          }
        >
          <Printer className="size-4" /> Imprimir cupom 80mm
        </Button>
        <Button variant="secondary" onClick={() => saveImage("cobranca")}>
          <ImageIcon className="size-4" /> Imagem da cobrança
        </Button>
        <Button variant="secondary" onClick={() => saveImage("recibo")}>
          <ImageIcon className="size-4" /> Imagem do recibo (pago)
        </Button>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
        Esta venda não foi salva na nuvem. Crie sua conta para guardar o histórico e o caixa.
        <Button className="mt-2 w-full" size="sm" onClick={onSignIn}>
          <UserPlus className="size-4" /> Criar conta com Google
        </Button>
      </div>
    </div>
  );
}
