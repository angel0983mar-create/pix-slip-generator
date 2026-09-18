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
  X,
  CreditCard,
  Banknote,
  QrCode,
  ArrowRight,
  FileText,
  Car,
  Check,
  Calculator,
  UtensilsCrossed,
  Shirt,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { buildPixPayload } from "@/lib/pix";
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
import {
  loadShortcutsConfig,
  matchesKey,
  type ShortcutActionId,
} from "@/lib/keyboard-shortcuts";

export const Route = createFileRoute("/pdv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terminal de Vendas & Orçamentos | Comprovante Pix" },
      {
        name: "description",
        content:
          "PDV e emissor de orçamentos e recibos adaptado para oficina mecânica, restaurante, mercado e varejo.",
      },
      { property: "og:title", content: "Terminal de Vendas & Orçamentos" },
      {
        property: "og:description",
        content: "Emissão ágil de orçamentos, recibos e vendas operadas pelo teclado com Pix.",
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
  item_type?: "servico" | "peca" | "produto";
}

const PAYMENT_OPTIONS = [
  { id: "pix", label: "Pix", hotkey: "1", icon: QrCode, desc: "QR Code imediato com Copia e Cola" },
  { id: "dinheiro", label: "Dinheiro", hotkey: "2", icon: Banknote, desc: "Cálculo automático de troco" },
  { id: "credito", label: "Cartão de Crédito", hotkey: "3", icon: CreditCard, desc: "Recebimento no cartão de crédito" },
  { id: "debito", label: "Cartão de Débito", hotkey: "4", icon: CreditCard, desc: "Recebimento no cartão de débito" },
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
  const { data: products = [] } = useProducts();

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

  // Card / Modal de Pagamento ao Finalizar
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [cashGiven, setCashGiven] = useState("");

  // Modal de Pesagem (Mercado)
  const [scaleItemName, setScaleItemName] = useState("");
  const [scalePriceKg, setScalePriceKg] = useState("");
  const [scaleGrams, setScaleGrams] = useState("");

  // Inserção de Item Avulso Inline
  const [freeOpen, setFreeOpen] = useState(false);
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");
  const [freeNote, setFreeNote] = useState("");

  // Estado Geral do Pedido / Carrinho
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [method, setMethod] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);

  // Campos específicos de Oficina & Serviços
  const [serviceDocType, setServiceDocType] = useState<"recibo" | "orcamento">("recibo");
  const [vehicleEquipment, setVehicleEquipment] = useState(""); // Veículo / Placa / Modelo
  const [technicianName, setTechnicianName] = useState(""); // Mecânico / Técnico
  const [serviceDiagnosis, setServiceDiagnosis] = useState(""); // Queixa / Diagnóstico
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newPartName, setNewPartName] = useState("");
  const [newPartPrice, setNewPartPrice] = useState("");

  // Campos específicos de Restaurante
  const [tableNumber, setTableNumber] = useState(""); // Mesa ou Comanda
  const [hasServiceFee, setHasServiceFee] = useState(false); // Taxa de serviço 10%
  const [waiterName, setWaiterName] = useState("");

  // Campos específicos de Moda / Varejo
  const [sellerName, setSellerName] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Inserção por código
  const [code, setCode] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);
  const freeNameRef = useRef<HTMLInputElement>(null);
  const serviceNameRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  // Cálculos financeiros
  const subtotal = lines.reduce((acc, line) => acc + line.qty * line.price, 0);
  const serviceFee = currentBranch === "restaurante" && hasServiceFee ? subtotal * 0.1 : 0;
  const discountValue = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal + serviceFee - discountValue);
  const qtyCount = lines.reduce((acc, line) => acc + line.qty, 0);

  // Subtotais específicos para oficina
  const totalServices = lines
    .filter((l) => l.item_type === "servico")
    .reduce((acc, l) => acc + l.qty * l.price, 0);
  const totalParts = lines
    .filter((l) => l.item_type === "peca" || !l.item_type)
    .reduce((acc, l) => acc + l.qty * l.price, 0);

  // Troco calculado para pagamento em dinheiro
  const cashNumeric = parseAmount(cashGiven);
  const changeAmount = method === "dinheiro" && cashNumeric > total ? cashNumeric - total : 0;

  const branchConfig = BUSINESS_BRANCHES[currentBranch] ?? BUSINESS_BRANCHES.mercado;

  // Auto-foco inicial
  useEffect(() => {
    if (currentBranch === "servicos") {
      serviceNameRef.current?.focus();
    } else {
      codeRef.current?.focus();
    }
  }, [currentBranch]);

  // Focar no campo de dinheiro ao abrir modal se dinheiro estiver selecionado
  useEffect(() => {
    if (paymentModalOpen && method === "dinheiro") {
      setTimeout(() => cashInputRef.current?.focus(), 80);
    }
  }, [paymentModalOpen, method]);

  function addLine(
    name: string,
    price: number,
    qty = 1,
    note?: string,
    item_type: "servico" | "peca" | "produto" = "produto",
  ) {
    setLines((current) => {
      const foundIndex = current.findIndex(
        (l) => l.name === name && l.price === price && l.note === note && l.item_type === item_type,
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
        item_type,
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

  // Inserção rápida por código ou leitor
  function submitCode(event?: React.FormEvent) {
    if (event) event.preventDefault();
    const raw = code.trim();
    if (!raw) return;

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
      addLine(byName.name, Number(byName.price), qtyToInsert, undefined, "produto");
      toast.success(
        `${qtyToInsert > 1 ? `${qtyToInsert}x ` : ""}${byName.name} — ${formatBRL(Number(byName.price) * qtyToInsert)}`,
      );
      setCode("");
      codeRef.current?.focus();
      return;
    }

    // Se for valor digitado direto (ex: 15,50)
    const directPrice = parseAmount(codeToSearch);
    if (directPrice > 0 && /^\d+([.,]\d{1,2})?$/.test(codeToSearch)) {
      addLine("Item Avulso", directPrice, qtyToInsert, undefined, "produto");
      toast.success(
        `${qtyToInsert > 1 ? `${qtyToInsert}x ` : ""}Item Avulso — ${formatBRL(directPrice * qtyToInsert)}`,
      );
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

  // Inserir serviço (Mão de Obra) em Oficina
  function handleAddService(e: React.FormEvent) {
    e.preventDefault();
    const name = newServiceName.trim();
    const price = parseAmount(newServicePrice);
    if (!name) {
      toast.error("Informe o nome do serviço ou mão de obra.");
      return;
    }
    if (price <= 0) {
      toast.error("Informe o valor da mão de obra.");
      return;
    }
    addLine(name, price, 1, undefined, "servico");
    toast.success(`Serviço adicionado: ${name} — ${formatBRL(price)}`);
    setNewServiceName("");
    setNewServicePrice("");
    serviceNameRef.current?.focus();
  }

  // Inserir peça / material em Oficina
  function handleAddPart(e: React.FormEvent) {
    e.preventDefault();
    const name = newPartName.trim();
    const price = parseAmount(newPartPrice);
    if (!name) {
      toast.error("Informe o nome da peça ou material.");
      return;
    }
    if (price <= 0) {
      toast.error("Informe o valor da peça.");
      return;
    }
    addLine(name, price, 1, undefined, "peca");
    toast.success(`Peça adicionada: ${name} — ${formatBRL(price)}`);
    setNewPartName("");
    setNewPartPrice("");
  }

  // Inserir item avulso genérico
  function handleAddFreeItem(e: React.FormEvent) {
    e.preventDefault();
    const name = freeName.trim() || "Item Avulso";
    const price = parseAmount(freePrice);
    if (price <= 0) {
      toast.error("Informe um valor válido em reais.");
      return;
    }
    addLine(name, price, 1, freeNote.trim() || undefined, "produto");
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
    addLine(`${itemName} (${grams}g)`, calculatedPrice, 1, undefined, "produto");
    setScaleModalOpen(false);
    setScaleItemName("");
    setScalePriceKg("");
    setScaleGrams("");
    toast.success(`${itemName} (${grams}g) — ${formatBRL(calculatedPrice)}`);
    codeRef.current?.focus();
  }

  // Ação de iniciar fechamento (Abre o Card de Pagamento)
  function handleInitiateCheckout() {
    if (!lines.length) {
      toast.error("Adicione itens, serviços ou peças para continuar.");
      return;
    }

    // Se for orçamento puro em oficina, salva direto sem exigir pagamento
    if (currentBranch === "servicos" && serviceDocType === "orcamento") {
      void processSaveOrder("orcamento");
      return;
    }

    // Abre o card dedicado de pagamento
    setPaymentModalOpen(true);
  }

  // Teclas de atalho globais
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const isFKey = event.key.startsWith("F") && !isNaN(Number(event.key.slice(1)));

      // Quando o modal de pagamento está aberto
      if (paymentModalOpen) {
        if (event.key === "Escape") {
          event.preventDefault();
          setPaymentModalOpen(false);
          return;
        }

        // Teclas 1, 2, 3, 4 selecionam a forma de pagamento
        if (["1", "2", "3", "4"].includes(event.key) && (!isInputFocused || target !== cashInputRef.current)) {
          event.preventDefault();
          const map: Record<string, string> = {
            "1": "pix",
            "2": "dinheiro",
            "3": "credito",
            "4": "debito",
          };
          const next = map[event.key];
          if (next) setMethod(next);
          return;
        }

        // Enter no modal de pagamento confirma a finalização
        if (event.key === "Enter" && !busy) {
          event.preventDefault();
          void processSaveOrder(method);
          return;
        }
        return;
      }

      // Atalho: Foco no Leitor (F1)
      if (matchesKey(event, shortcutsConfig.focus_barcode)) {
        event.preventDefault();
        codeRef.current?.focus();
        codeRef.current?.select();
        return;
      }

      // Atalho: Item Avulso (F2)
      if (matchesKey(event, shortcutsConfig.open_free_item)) {
        event.preventDefault();
        setFreeOpen(true);
        setTimeout(() => freeNameRef.current?.focus(), 60);
        return;
      }

      // Atalho: Balança (F3)
      if (matchesKey(event, shortcutsConfig.open_weigh)) {
        event.preventDefault();
        setScaleModalOpen(true);
        return;
      }

      // Atalho: Finalizar Venda (F4 ou F8) -> Abre Card de Pagamento
      if (matchesKey(event, shortcutsConfig.checkout) || event.key === "F8") {
        event.preventDefault();
        handleInitiateCheckout();
        return;
      }

      // Atalho: Limpar Carrinho (F9)
      if (matchesKey(event, shortcutsConfig.clear_cart) || event.key === "F9") {
        if (!isInputFocused || isFKey) {
          event.preventDefault();
          if (lines.length) {
            setLines([]);
            toast.info("Carrinho esvaziado.");
          }
          return;
        }
      }

      // Atalho: Consultar Atalhos (F10)
      if (matchesKey(event, shortcutsConfig.open_shortcuts) || event.key === "F10") {
        event.preventDefault();
        setShortcutsModalOpen(true);
        return;
      }

      // Esc: Fechar qualquer modal
      if (event.key === "Escape") {
        setFreeOpen(false);
        setScaleModalOpen(false);
        setShortcutsModalOpen(false);
        setWishlistOpen(false);
        setPaymentModalOpen(false);
        if (currentBranch === "servicos") {
          serviceNameRef.current?.focus();
        } else {
          codeRef.current?.focus();
        }
        return;
      }

      // Atalhos de Desconto (Moda): Alt+0, Alt+5, Alt+1, Alt+2, Alt+3
      if (event.altKey && currentBranch === "moda") {
        if (event.key === "0") {
          event.preventDefault();
          setDiscountPercent(0);
          toast.info("Sem desconto");
        } else if (event.key === "5") {
          event.preventDefault();
          setDiscountPercent(5);
          toast.info("Desconto 5%");
        } else if (event.key === "1") {
          event.preventDefault();
          setDiscountPercent(10);
          toast.info("Desconto 10%");
        } else if (event.key === "2") {
          event.preventDefault();
          setDiscountPercent(15);
          toast.info("Desconto 15%");
        } else if (event.key === "3") {
          event.preventDefault();
          setDiscountPercent(20);
          toast.info("Desconto 20%");
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
  }, [shortcutsConfig, lines, total, busy, currentBranch, code, paymentModalOpen, method]);

  // Salvar pedido no banco ou localmente
  async function processSaveOrder(paymentMethodChosen: string) {
    if (!profile) return;
    if (total <= 0 && paymentMethodChosen !== "orcamento") {
      toast.error("Adicione itens para finalizar.");
      return;
    }
    if (paymentMethodChosen === "pix" && !profile.pix_key) {
      toast.error("Cadastre sua chave Pix em Configurações para gerar o QR Code.");
      return;
    }

    setBusy(true);
    try {
      const items: OrderItem[] = lines.map(({ name, qty, price, note, item_type }) => {
        const typePrefix =
          currentBranch === "servicos" && item_type === "servico"
            ? "[SERVIÇO] "
            : currentBranch === "servicos" && item_type === "peca"
              ? "[PEÇA] "
              : "";
        return {
          name: `${typePrefix}${name}${note ? ` (${note})` : ""}`,
          qty,
          price,
        };
      });

      const parts: string[] = [];
      if (currentBranch === "servicos") {
        parts.push(serviceDocType === "orcamento" ? "ORÇAMENTO" : "ORDEM DE SERVIÇO");
        if (vehicleEquipment.trim()) parts.push(`Veículo/Equip: ${vehicleEquipment.trim()}`);
        if (technicianName.trim()) parts.push(`Mecânico: ${technicianName.trim()}`);
        if (serviceDiagnosis.trim()) parts.push(`Diag: ${serviceDiagnosis.trim()}`);
      } else if (currentBranch === "restaurante") {
        if (tableNumber.trim()) parts.push(`Mesa/Comanda: ${tableNumber.trim()}`);
        if (waiterName.trim()) parts.push(`Atendente: ${waiterName.trim()}`);
        if (hasServiceFee) parts.push("Taxa 10%");
      } else if (currentBranch === "moda") {
        if (sellerName.trim()) parts.push(`Vendedor: ${sellerName.trim()}`);
        if (discountPercent > 0) parts.push(`Desc. ${discountPercent}%`);
      }

      parts.push(items.map((i) => `${i.qty}x ${i.name}`).join(", "));
      const description = parts.join(" | ").slice(0, 180);

      // Nome do cliente
      const finalCustomer =
        customer.trim() ||
        (currentBranch === "restaurante" && tableNumber
          ? `Mesa ${tableNumber}`
          : currentBranch === "servicos" && vehicleEquipment
            ? vehicleEquipment
            : "Cliente");

      if (isGuest) {
        const number = nextLocalOrderNumber();
        const now = new Date().toISOString();
        const order: Order = {
          id: `local-${number}`,
          user_id: "local",
          order_number: number,
          customer_name: finalCustomer,
          customer_contact: customerContact.trim() || null,
          description,
          items,
          amount: total,
          status: paymentMethodChosen === "orcamento" ? "aberto" : "pago",
          payment_method: paymentMethodChosen,
          pix_payload:
            paymentMethodChosen === "pix" && profile.pix_key
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
          notes: serviceDiagnosis.trim() || null,
          due_date: null,
          paid_at: paymentMethodChosen === "orcamento" ? null : now,
          created_at: now,
          updated_at: now,
        };
        setResult(order);
        setPaymentModalOpen(false);
        setLines([]);
        setCustomer("");
        setCustomerContact("");
        setDiscountPercent(0);
        setCashGiven("");
        return;
      }

      const { data: created, error } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          customer_name: finalCustomer,
          customer_contact: customerContact.trim() || null,
          description,
          items: items as unknown as never,
          amount: total,
          payment_method: paymentMethodChosen,
          status: paymentMethodChosen === "orcamento" ? "aberto" : "aberto",
          notes: serviceDiagnosis.trim() || null,
        })
        .select("id, order_number")
        .single();
      if (error) throw error;

      if (paymentMethodChosen === "pix" && profile.pix_key) {
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
      setPaymentModalOpen(false);
      setLines([]);
      setCustomer("");
      setCustomerContact("");
      setDiscountPercent(0);
      setCashGiven("");
      navigate({ to: "/pedidos/$id", params: { id: created.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
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
                {profile?.store_name ?? "Minha Loja"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {currentBranch === "servicos"
                  ? "Emissor de Orçamentos & Serviços"
                  : currentBranch === "restaurante"
                    ? "Gestão de Mesas & Comandas"
                    : currentBranch === "moda"
                      ? "Varejo & Moda"
                      : "Terminal de Caixa"}
              </span>
            </div>

            {/* Ramo com indicação de alterar em Configurações */}
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

      {/* Corpo Principal do PDV / Gerador de Pedidos */}
      <main className="mx-auto max-w-7xl px-4 pt-4">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_390px]">
          {/* ============================================================ */}
          {/* COLUNA ESQUERDA: LAYOUT ADAPTADO AO RAMO                     */}
          {/* ============================================================ */}
          <section className="space-y-4">
            {/* ---------------------------------------------------------- */}
            {/* RAMO 1: OFICINA MECÂNICA / ASSISTÊNCIA / SERVIÇOS          */}
            {/* ---------------------------------------------------------- */}
            {currentBranch === "servicos" ? (
              <div className="space-y-4">
                {/* Seletor de Tipo: Orçamento vs Ordem de Serviço / Recibo */}
                <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Wrench className="size-4 text-blue-400" />
                      <span className="text-sm font-semibold">Oficina & Serviços</span>
                    </div>

                    <div className="inline-flex rounded-lg border border-border/60 bg-secondary/30 p-0.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setServiceDocType("recibo")}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          serviceDocType === "recibo"
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Ordem de Serviço / Recibo
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceDocType("orcamento")}
                        className={`px-3 py-1 rounded-md transition-colors ${
                          serviceDocType === "orcamento"
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Gerar Orçamento
                      </button>
                    </div>
                  </div>

                  {/* Dados do Veículo / Equipamento & Cliente */}
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Veículo / Equipamento
                      </Label>
                      <Input
                        placeholder="Ex: Fiat Palio 2018 - ABC1D23"
                        value={vehicleEquipment}
                        onChange={(e) => setVehicleEquipment(e.target.value)}
                        className="h-8 text-xs bg-background/60"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Mecânico / Técnico
                      </Label>
                      <Input
                        placeholder="Nome do responsável"
                        value={technicianName}
                        onChange={(e) => setTechnicianName(e.target.value)}
                        className="h-8 text-xs bg-background/60"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-muted-foreground">
                        WhatsApp / Contato
                      </Label>
                      <Input
                        placeholder="(00) 00000-0000"
                        value={customerContact}
                        onChange={(e) => setCustomerContact(e.target.value)}
                        className="h-8 text-xs bg-background/60"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Diagnóstico / Queixa do Cliente
                    </Label>
                    <Input
                      placeholder="Ex: Barulho na suspensão dianteira ao frear"
                      value={serviceDiagnosis}
                      onChange={(e) => setServiceDiagnosis(e.target.value)}
                      className="h-8 text-xs bg-background/60"
                    />
                  </div>
                </div>

                {/* Seção de Inserção: Serviços (Mão de Obra) */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                      <Wrench className="size-3.5" /> 1. Inserir Mão de Obra / Serviços
                    </span>
                    <span className="text-[11px] font-mono text-blue-400 font-bold">
                      Subtotal Serviços: {formatBRL(totalServices)}
                    </span>
                  </div>

                  <form onSubmit={handleAddService} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                    <Input
                      ref={serviceNameRef}
                      placeholder="Ex: Troca de pastilhas de freio e sangria"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                    <Input
                      placeholder="Mão de Obra (R$)"
                      inputMode="decimal"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="h-9 text-xs font-mono bg-background"
                    />
                    <Button type="submit" size="sm" className="h-9 text-xs">
                      <Plus className="size-3.5 mr-1" /> Adicionar Serviço
                    </Button>
                  </form>
                </div>

                {/* Seção de Inserção: Peças e Materiais */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                      <Package className="size-3.5" /> 2. Inserir Peças e Materiais Aplicados
                    </span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">
                      Subtotal Peças: {formatBRL(totalParts)}
                    </span>
                  </div>

                  <form onSubmit={handleAddPart} className="grid gap-2 sm:grid-cols-[1fr_130px_auto]">
                    <Input
                      placeholder="Ex: Jogo de Pastilhas Dianteiras Bosch"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="h-9 text-xs bg-background"
                    />
                    <Input
                      placeholder="Valor Peça (R$)"
                      inputMode="decimal"
                      value={newPartPrice}
                      onChange={(e) => setNewPartPrice(e.target.value)}
                      className="h-9 text-xs font-mono bg-background"
                    />
                    <Button type="submit" variant="secondary" size="sm" className="h-9 text-xs">
                      <Plus className="size-3.5 mr-1" /> Adicionar Peça
                    </Button>
                  </form>
                </div>
              </div>
            ) : null}

            {/* ---------------------------------------------------------- */}
            {/* RAMO 2: RESTAURANTE & LANCHONETE (Comandas & Mesas)       */}
            {/* ---------------------------------------------------------- */}
            {currentBranch === "restaurante" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-2.5">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <ChefHat className="size-4" />
                      <span>Identificação do Pedido / Mesa</span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasServiceFee}
                        onChange={(e) => setHasServiceFee(e.target.checked)}
                        className="rounded border-border accent-primary size-3.5"
                      />
                      <span>Incluir 10% de serviço (+{formatBRL(serviceFee)})</span>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-amber-300">Número da Mesa ou Comanda</Label>
                      <Input
                        placeholder="Ex: Mesa 04 / Comanda 12"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        className="h-8 text-xs bg-background/70 font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-amber-300">Atendente / Garçom</Label>
                      <Input
                        placeholder="Nome de quem atendeu"
                        value={waiterName}
                        onChange={(e) => setWaiterName(e.target.value)}
                        className="h-8 text-xs bg-background/70"
                      />
                    </div>
                  </div>
                </div>

                {/* Inserção de Itens / Bebidas / Pratos */}
                <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm">
                  <form onSubmit={submitCode} className="space-y-2">
                    <div className="relative flex items-center">
                      <Barcode className="absolute left-3 size-4 text-muted-foreground" />
                      <Input
                        ref={codeRef}
                        className="h-10 pl-10 pr-20 text-xs sm:text-sm font-mono bg-background/80 border-border/70"
                        placeholder=""
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="off"
                      />
                      <Button type="submit" size="sm" className="absolute right-1.5 h-7 px-2.5 text-xs">
                        Lançar
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <Button
                        type="button"
                        variant={freeOpen ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFreeOpen(!freeOpen)}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="size-3" /> Item / Prato Avulso
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        Multiplicador: <code className="font-mono text-foreground">2*código</code>
                      </span>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {/* ---------------------------------------------------------- */}
            {/* RAMO 3: MODA & VAREJO (Vendedor & Descontos)               */}
            {/* ---------------------------------------------------------- */}
            {currentBranch === "moda" ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 p-3.5 backdrop-blur-sm space-y-3">
                  <div className="flex items-center gap-2 text-pink-400 font-semibold text-xs">
                    <Shirt className="size-4" />
                    <span>Varejo & Vestuário</span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-pink-300">Vendedor / Consultor</Label>
                      <Input
                        placeholder="Nome do vendedor"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        className="h-8 text-xs bg-background/70"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-pink-300">Desconto Balcão</Label>
                      <div className="grid grid-cols-5 gap-1">
                        {DISCOUNT_OPTIONS.map((opt) => (
                          <button
                            key={opt.pct}
                            type="button"
                            onClick={() => setDiscountPercent(opt.pct)}
                            className={`rounded py-1 text-xs font-medium transition-colors ${
                              discountPercent === opt.pct
                                ? "bg-primary text-primary-foreground font-bold"
                                : "bg-secondary/40 text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inserção de Etiqueta / Código de Barras */}
                <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm">
                  <form onSubmit={submitCode} className="space-y-2">
                    <div className="relative flex items-center">
                      <Barcode className="absolute left-3 size-4 text-muted-foreground" />
                      <Input
                        ref={codeRef}
                        className="h-10 pl-10 pr-20 text-xs sm:text-sm font-mono bg-background/80 border-border/70"
                        placeholder=""
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        autoComplete="off"
                      />
                      <Button type="submit" size="sm" className="absolute right-1.5 h-7 px-2.5 text-xs">
                        Inserir
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <Button
                        type="button"
                        variant={freeOpen ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFreeOpen(!freeOpen)}
                        className="h-7 text-xs gap-1"
                      >
                        <Plus className="size-3" /> Peça Avulsa
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        Atalhos de desconto: <kbd className="font-mono text-foreground">Alt+0</kbd> a <kbd className="font-mono text-foreground">Alt+3</kbd>
                      </span>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {/* ---------------------------------------------------------- */}
            {/* RAMO 4 E 5: MERCADO & COMÉRCIO GERAL (Inserção Contínua)  */}
            {/* ---------------------------------------------------------- */}
            {currentBranch === "mercado" || currentBranch === "geral" ? (
              <div className="rounded-xl border border-border/60 bg-card/40 p-3.5 backdrop-blur-sm shadow-xs">
                <form onSubmit={submitCode} className="space-y-2.5">
                  <div className="relative flex items-center">
                    <Barcode className="absolute left-3 size-5 text-muted-foreground" />
                    <Input
                      ref={codeRef}
                      className="h-12 pl-11 pr-24 text-sm sm:text-base font-mono bg-background/80 border-border/70 focus-visible:ring-1 focus-visible:ring-primary"
                      placeholder=""
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
              </div>
            ) : null}

            {/* Inserção de Item Avulso Inline (se aberto) */}
            {freeOpen ? (
              <form
                onSubmit={handleAddFreeItem}
                className="rounded-lg border border-primary/20 bg-secondary/30 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span className="flex items-center gap-1.5">
                    <Tag className="size-3.5" /> Inserção de Item Avulso
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
                    placeholder="Descrição do item"
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

            {/* TABELA DE ITENS INSERIDOS NO PEDIDO / ORÇAMENTO */}
            <div className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-foreground">
                  {currentBranch === "servicos"
                    ? `Itens da OS / Orçamento (${qtyCount})`
                    : `Itens Lançados (${qtyCount})`}
                </span>
                <span className="text-[11px]">
                  Use <code className="font-mono text-foreground">+</code> / <code className="font-mono text-foreground">-</code> para ajustar quantidade
                </span>
              </div>

              {lines.length === 0 ? (
                <div className="py-12 text-center space-y-1.5">
                  <FileText className="mx-auto size-9 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    {currentBranch === "servicos"
                      ? "Nenhum serviço ou peça inserido no orçamento."
                      : "Nenhum item lançado no momento."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40 max-h-[460px] overflow-y-auto">
                  {lines.map((line, index) => (
                    <div
                      key={line.key}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-6 text-center">
                        {index + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {currentBranch === "servicos" && line.item_type === "servico" ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-blue-400/40 text-blue-400 bg-blue-400/10">
                              Serviço
                            </Badge>
                          ) : currentBranch === "servicos" && line.item_type === "peca" ? (
                            <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-400/40 text-emerald-400 bg-emerald-400/10">
                              Peça
                            </Badge>
                          ) : null}
                          <p className="text-xs sm:text-sm font-medium leading-tight truncate">
                            {line.name}
                          </p>
                        </div>
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

            {/* Configurações Locais de Visitante */}
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

          {/* ============================================================ */}
          {/* COLUNA DIREITA: RESUMO FINANCEIRO & BOTÃO DE FINALIZAR       */}
          {/* ============================================================ */}
          <aside className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm space-y-4">
              {/* Display do Total Geral */}
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {currentBranch === "servicos" && serviceDocType === "orcamento"
                      ? "Valor do Orçamento"
                      : "Total da Cobrança"}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {qtyCount} {qtyCount === 1 ? "item" : "itens"}
                  </Badge>
                </div>

                <div className="font-mono text-3xl font-bold tracking-tight text-primary">
                  {formatBRL(total)}
                </div>

                {/* Subtotais detalhados por ramo */}
                {currentBranch === "servicos" ? (
                  <div className="space-y-0.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Mão de Obra:</span>
                      <span className="font-mono font-medium text-blue-400">{formatBRL(totalServices)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Peças & Materiais:</span>
                      <span className="font-mono font-medium text-emerald-400">{formatBRL(totalParts)}</span>
                    </div>
                  </div>
                ) : null}

                {currentBranch === "restaurante" && hasServiceFee ? (
                  <div className="flex justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span>Taxa de serviço (10%):</span>
                    <span className="font-mono font-medium text-amber-400">+{formatBRL(serviceFee)}</span>
                  </div>
                ) : null}

                {discountPercent > 0 ? (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40 text-muted-foreground">
                    <span>Desconto ({discountPercent}%):</span>
                    <span className="text-pink-400 font-mono">-{formatBRL(discountValue)}</span>
                  </div>
                ) : null}
              </div>

              {/* Identificação do Cliente */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
                <Input
                  className="h-8 text-xs bg-background/60"
                  placeholder="Nome do cliente"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>

              {/* Botão de Finalização Principal */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Button
                  className="w-full h-11 text-sm font-semibold tracking-wide justify-between"
                  disabled={busy || !lines.length}
                  onClick={handleInitiateCheckout}
                >
                  {busy ? (
                    <span className="flex items-center gap-2 mx-auto">
                      <Loader2 className="size-4 animate-spin" /> Concluindo...
                    </span>
                  ) : currentBranch === "servicos" && serviceDocType === "orcamento" ? (
                    <>
                      <span>Salvar & Emitir Orçamento</span>
                      <FileText className="size-4" />
                    </>
                  ) : (
                    <>
                      <span>Finalizar e Pagar</span>
                      <kbd className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[11px]">
                        F8
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
                      if (currentBranch === "servicos") {
                        serviceNameRef.current?.focus();
                      } else {
                        codeRef.current?.focus();
                      }
                    }}
                  >
                    <span>Limpar Tudo</span>
                    <kbd className="font-mono text-[10px]">F9</kbd>
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
                  if (currentBranch === "servicos") {
                    serviceNameRef.current?.focus();
                  } else {
                    codeRef.current?.focus();
                  }
                }}
                onSignIn={signInWithGoogle}
              />
            ) : null}
          </aside>
        </div>
      </main>

      {/* ============================================================ */}
      {/* CARD / MODAL DEDICADO DE FORMA DE PAGAMENTO AO FINALIZAR     */}
      {/* ============================================================ */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Coins className="size-5 text-primary" />
                <span>Escolha a Forma de Pagamento</span>
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Selecione com as teclas <kbd className="font-mono text-foreground font-bold">1</kbd>, <kbd className="font-mono text-foreground font-bold">2</kbd>, <kbd className="font-mono text-foreground font-bold">3</kbd> ou <kbd className="font-mono text-foreground font-bold">4</kbd>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Total Destacado */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-center">
              <p className="text-xs text-muted-foreground font-medium">Total a Pagar</p>
              <p className="text-3xl font-mono font-extrabold text-primary">{formatBRL(total)}</p>
            </div>

            {/* Grid de Formas de Pagamento */}
            <div className="grid gap-2">
              {PAYMENT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = method === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMethod(opt.id)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary shadow-xs"
                        : "border-border/60 bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid size-9 place-items-center rounded-lg ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight text-foreground">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </div>

                    <kbd
                      className={`rounded px-2 py-0.5 font-mono text-xs font-bold border ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {opt.hotkey}
                    </kbd>
                  </button>
                );
              })}
            </div>

            {/* Campo Opcional de Dinheiro Recebido para Troco */}
            {method === "dinheiro" ? (
              <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cash-given" className="text-xs font-medium">
                    Valor Entregue pelo Cliente (R$)
                  </Label>
                  {changeAmount > 0 ? (
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      Troco: {formatBRL(changeAmount)}
                    </span>
                  ) : null}
                </div>
                <Input
                  ref={cashInputRef}
                  id="cash-given"
                  placeholder="Ex: 50,00"
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  className="h-9 text-sm font-mono"
                  inputMode="decimal"
                />
              </div>
            ) : null}

            {/* Botões de Ação do Modal */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPaymentModalOpen(false)}
                className="text-xs"
              >
                Voltar (Esc)
              </Button>
              <Button
                type="button"
                size="default"
                className="gap-2 font-semibold"
                disabled={busy}
                onClick={() => processSaveOrder(method)}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Concluindo...
                  </>
                ) : (
                  <>
                    <span>Confirmar e Emitir</span>
                    <kbd className="rounded bg-primary-foreground/20 px-1.5 py-0.5 font-mono text-[10px]">
                      Enter
                    </kbd>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                Total:{" "}
                {formatBRL(
                  Math.round(parseAmount(scalePriceKg) * (parseFloat(scaleGrams) / 1000) * 100) /
                    100,
                )}
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
