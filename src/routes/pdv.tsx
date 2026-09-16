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
  Sparkles,
  Tag,
  Check,

  Check,
  Loader2,
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

  // Ramo definido nas Configurações (conta) ou nos dados locais (visitante)
  const currentBranch: BusinessBranch =
    ((isGuest ? settings.business_branch : remoteProfile?.business_branch) as BusinessBranch) ||
    "mercado";


  // Modal de desejos / sugestões dos clientes
  const [wishlistOpen, setWishlistOpen] = useState(false);

  // Modal de Pesagem (Mercado)
  const [scaleModalOpen, setScaleModalOpen] = useState(false);
  const [scaleItemName, setScaleItemName] = useState("");
  const [scalePriceKg, setScalePriceKg] = useState("");
  const [scaleGrams, setScaleGrams] = useState("");

  // Campos específicos de ramos
  const [tableNumber, setTableNumber] = useState(""); // Restaurante
  const [technicianName, setTechnicianName] = useState(""); // Serviços
  const [discountPercent, setDiscountPercent] = useState<number>(0); // Moda / Varejo
  const [itemNote, setItemNote] = useState("");

  const [code, setCode] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("pix");
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const freeNameRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<HTMLElement>(null);

  const subtotal = lines.reduce((acc, line) => acc + line.qty * line.price, 0);
  const discountValue = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal - discountValue);
  const qtyCount = lines.reduce((acc, line) => acc + line.qty, 0);

  const branchConfig = BUSINESS_BRANCHES[currentBranch] ?? BUSINESS_BRANCHES.mercado;

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
    const clean = value.replace(/\s/g, "").toLowerCase();
    const actives = products.filter((p) => p.active !== false);

    const byBarcode = actives.find(
      (p) => (p.barcode ?? "").replace(/\s/g, "").toLowerCase() === clean,
    );
    const byName =
      byBarcode ??
      actives.find((p) => p.name.toLowerCase() === value.trim().toLowerCase()) ??
      actives.find((p) => p.name.toLowerCase().startsWith(value.trim().toLowerCase()));

    if (byName) {
      addLine(byName.name, Number(byName.price));
      toast.success(`${byName.name} — ${formatBRL(Number(byName.price))}`);
      setCode("");
      codeRef.current?.focus();
      return;
    }
    toast.error(`"${value}" não está cadastrado.`, {
      action: { label: "Cadastrar", onClick: () => navigate({ to: "/produtos" }) },
    });
    setCode("");
    codeRef.current?.focus();
  }

  // Teclas de atalho: operar o caixa sem mouse
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        codeRef.current?.focus();
        codeRef.current?.select();
        return;
      }
      if (event.key === "F3") {
        event.preventDefault();
        setFreeOpen(true);
        setTimeout(() => freeNameRef.current?.focus(), 60);
        return;
      }
      if (event.key === "F4" && currentBranch === "mercado") {
        event.preventDefault();
        setScaleModalOpen(true);
        return;
      }
      if (event.key === "F8") {
        event.preventDefault();
        if (lines.length && !busy) void checkout();
        return;
      }
      if (event.key === "F9") {
        event.preventDefault();
        if (lines.length) {
          setLines([]);
          toast.info("Carrinho limpo.");
        }
        codeRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        codeRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  function changeQty(key: string, delta: number) {
    setLines((current) =>
      current
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0),
    );
  }

  function addFreeItem() {
    const price = parseAmount(freePrice);
    if (price <= 0) {
      toast.error("Informe o valor do item.");
      return;
    }
    addLine(freeName.trim() || "Item avulso", price, itemNote.trim() || undefined);
    setFreeName("");
    setFreePrice("");
    setItemNote("");
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
      {/* Header Principal */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Logo e Nome da Loja */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              {profile?.store_logo_url ? (
                <img
                  src={profile.store_logo_url}
                  alt={profile.store_name}
                  className="size-9 rounded-xl border border-border object-cover"
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
                  {branchConfig.label}
                </span>
              </div>
            </Link>

            {/* Ramo definido nas Configurações */}
            {isGuest ? (
              <a
                href="#config-loja"
                className="flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-2.5 text-xs font-medium hover:bg-secondary"
              >
                <span className="text-sm">{branchConfig.icon}</span>
                <span className="hidden sm:inline">Ramo nas configurações</span>
                <Sparkles className="size-3.5 text-primary" />
              </a>
            ) : (
              <Link
                to="/configuracoes"
                className="flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-secondary/50 px-2.5 text-xs font-medium hover:bg-secondary"
              >
                <span className="text-sm">{branchConfig.icon}</span>
                <span className="hidden sm:inline">Ramo nas configurações</span>
                <Settings className="size-3.5 text-muted-foreground" />
              </Link>
            )}

          </div>

          {/* Ações do Header */}
          <div className="flex items-center gap-2">
            {/* Botão de Central de Desejos */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWishlistOpen(true)}
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 text-xs"
            >
              <Lightbulb className="size-3.5" />
              <span className="hidden sm:inline">Desejar layout/função</span>
              <span className="sm:hidden">Desejar</span>
            </Button>

            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to="/produtos">
                <Package className="size-4" /> Produtos
              </Link>
            </Button>

            {isGuest ? (
              <Button size="sm" onClick={signInWithGoogle} className="text-xs">
                <UserPlus className="size-3.5" /> Salvar no Google
              </Button>
            ) : (
              <Button variant="secondary" size="sm" asChild className="text-xs">
                <Link to="/pedidos">Meus pedidos</Link>
              </Button>
            )}
          </div>
        </div>

        {/* Banner do Ramo selecionado com Tagline */}
        <div className="border-t border-border/60 bg-secondary/30 px-4 py-1.5">
          <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${branchConfig.badgeColor}`}>
                Modo {branchConfig.label.split(" ")[0]}
              </Badge>
              <span className="hidden md:inline">{branchConfig.tagline}</span>
            </div>

            {isGuest ? (
              <span className="text-[11px]">
                Modo visitante (salva neste aparelho)
              </span>
            ) : (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                ● Caixa conectado
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-5 lg:grid-cols-[1fr_400px]">
        <section className="space-y-4">
          {/* Barra de Código de Barras + Pesagem (se mercado) */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <form onSubmit={submitCode} className="panel flex flex-1 items-center gap-2 p-3">
              <Barcode className="size-5 shrink-0 text-primary" />
              <Input
                ref={codeRef}
                autoFocus
                className="h-10 flex-1 text-base"
                inputMode="numeric"
                placeholder={
                  currentBranch === "mercado"
                    ? "Passe o leitor de código de barras ou digite o número"
                    : "Passe o código de barras do item"
                }
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" size="sm" className="h-10 px-4">
                Bipar
              </Button>
            </form>

            {/* Recurso Rápido do Ramo Mercado: Balança / Pesagem */}
            {currentBranch === "mercado" ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setScaleModalOpen(true)}
                className="h-auto gap-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 py-3"
              >
                <Scale className="size-5" />
                <span className="text-xs font-semibold">Pesar por Kg</span>
              </Button>
            ) : null}
          </div>

          {/* Aviso: PDV é somente de inserção — sem seleção de produtos */}
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2.5">
              <Tag className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Caixa de inserção rápida</p>
                <p className="text-xs text-muted-foreground">
                  Bipe o código de barras ou digite o nome do produto e pressione Enter. Nada de
                  procurar item na tela: o caixa não sai do teclado.
                  {productsLoading
                    ? " Carregando catálogo…"
                    : ` ${products.filter((p) => p.active !== false).length} produtos cadastrados.`}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild className="text-xs">
              <Link to="/produtos">
                <Package className="size-3.5" /> Cadastrar produtos
              </Link>
            </Button>
          </div>

          {/* Teclas de atalho */}
          <div className="panel flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Check className="size-3.5 text-primary" /> Atalhos do teclado
            </span>
            <span><kbd className="kbd">F2</kbd> código de barras</span>
            <span><kbd className="kbd">F3</kbd> item avulso</span>
            {currentBranch === "mercado" ? (
              <span><kbd className="kbd">F4</kbd> pesar por kg</span>
            ) : null}
            <span><kbd className="kbd">F8</kbd> finalizar venda</span>
            <span><kbd className="kbd">F9</kbd> limpar carrinho</span>
            <span><kbd className="kbd">Esc</kbd> voltar ao código</span>
          </div>


          {/* Recursos Específicos por Ramo: Mesa (Restaurante), Técnico (Serviços), Desconto (Moda) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {currentBranch === "restaurante" ? (
              <div className="panel space-y-2 p-3.5 border-amber-500/30 bg-amber-500/5">
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
              <div className="panel space-y-2 p-3.5 border-blue-500/30 bg-blue-500/5">
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

          {/* Item avulso colapsável (limpeza visual) */}
          <details className="panel group p-4">
            <summary className="flex cursor-pointer select-none items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Plus className="size-4 text-primary" />
                Incluir item avulso ou sem cadastro
              </span>
              <ChevronDown className="size-4 transition-transform group-open:rotate-180 text-muted-foreground" />
            </summary>
            <div className="mt-3 space-y-3 pt-2 border-t border-border">
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-40 flex-1"
                  placeholder="Descrição do item ou serviço"
                  value={freeName}
                  onChange={(e) => setFreeName(e.target.value)}
                />
                <Input
                  className="w-28"
                  inputMode="decimal"
                  placeholder="Valor (R$)"
                  value={freePrice}
                  onChange={(e) => setFreePrice(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={addFreeItem}>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>
              <Input
                placeholder="Observação do item (opcional, ex: sem cebola / com defeito)"
                value={itemNote}
                onChange={(e) => setItemNote(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </details>

          {/* Configuração da loja (Visitante) com Logo e Ramo */}
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
                  <p className="text-xs">Bipe um código ou toque nos produtos para adicionar.</p>
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
                  "Finalizar e gerar cobrança"
                )}
              </Button>

              {lines.length ? (
                <Button className="w-full" variant="ghost" size="sm" onClick={() => setLines([])}>
                  Limpar carrinho
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

      <div className="grid gap-3 sm:grid-cols-2">
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

        <div className="space-y-1 sm:col-span-2">
          <Label>URL do Logo da Loja (opcional)</Label>
          <Input
            placeholder="https://exemplo.com/logo.png"
            value={form.store_logo_url ?? ""}
            onChange={(e) => setForm({ ...form, store_logo_url: e.target.value || null })}
          />
          <p className="text-[11px] text-muted-foreground">
            Cole o link direto da imagem da sua marca para exibir no topo do PDV e nos comprovantes.
          </p>
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

        <div className="space-y-1">
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
