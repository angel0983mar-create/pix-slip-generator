import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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

export const Route = createFileRoute("/pdv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PDV rápido — venda por código de barras | Comprovante Pix" },
      {
        name: "description",
        content:
          "Passe o código de barras, monte o carrinho e gere o QR Code Pix com recibo na hora. Use grátis, sem conta, e salve depois com o Google.",
      },
      { property: "og:title", content: "PDV rápido com código de barras e Pix" },
      {
        property: "og:description",
        content: "Carrinho, código de barras, QR Code Pix e recibo para imprimir em A4 ou cupom.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PdvPage,
});

interface CartLine extends OrderItem {
  key: string;
}

function PdvPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: sessionLoading } = useSession();
  const isGuest = !sessionLoading && !user;
  const { data: remoteProfile } = useProfile();
  const { data: products = [] } = useProducts();

  const [settings, setSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const profile: Profile | null = isGuest ? localProfile(settings) : (remoteProfile ?? null);

  const [code, setCode] = useState("");
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState("");
  const [method, setMethod] = useState("pix");
  const [freeName, setFreeName] = useState("");
  const [freePrice, setFreePrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Order | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const total = lines.reduce((acc, line) => acc + line.qty * line.price, 0);
  const qtyCount = lines.reduce((acc, line) => acc + line.qty, 0);

  const visible = useMemo(() => {
    const search = term.trim().toLowerCase();
    return products
      .filter((p) => p.active !== false)
      .filter(
        (p) =>
          !search ||
          p.name.toLowerCase().includes(search) ||
          (p.barcode ?? "").includes(search) ||
          (p.category ?? "").toLowerCase().includes(search),
      )
      .slice(0, 24);
  }, [products, term]);

  function addLine(name: string, price: number) {
    setLines((current) => {
      const found = current.find((l) => l.name === name && l.price === price);
      if (found) {
        return current.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...current, { key: `${name}-${Date.now()}`, name, qty: 1, price }];
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

  function addFreeItem() {
    const price = parseAmount(freePrice);
    if (price <= 0) {
      toast.error("Informe o valor do item.");
      return;
    }
    addLine(freeName.trim() || "Item avulso", price);
    setFreeName("");
    setFreePrice("");
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
      const items: OrderItem[] = lines.map(({ name, qty, price }) => ({ name, qty, price }));
      const description = items.map((i) => `${i.qty}x ${i.name}`).join(", ").slice(0, 120);

      if (isGuest) {
        const number = nextLocalOrderNumber();
        const now = new Date().toISOString();
        const order: Order = {
          id: `local-${number}`,
          user_id: "local",
          order_number: number,
          customer_name: customer.trim() || "Cliente",
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
                  txid: `VENDA${number}`,
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
        return;
      }

      const { data: created, error } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          customer_name: customer.trim() || "Cliente",
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
              C
            </span>
            <span className="font-display text-lg font-semibold">{profile?.store_name ?? "PDV"}</span>
          </Link>
          <Badge variant="outline" className="ml-1">
            Caixa aberto
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/produtos">
                <Package className="size-4" /> Produtos
              </Link>
            </Button>
            {isGuest ? (
              <Button size="sm" onClick={signInWithGoogle}>
                <UserPlus className="size-4" /> Criar conta com Google
              </Button>
            ) : (
              <Button variant="secondary" size="sm" asChild>
                <Link to="/pedidos">Meus pedidos</Link>
              </Button>
            )}
          </div>
        </div>
        {isGuest ? (
          <p className="border-t border-border bg-secondary/60 px-4 py-2 text-center text-xs text-muted-foreground">
            Você está usando sem conta: produtos e vendas ficam apenas neste aparelho. Crie a conta
            do Google quando quiser salvar tudo.
          </p>
        ) : null}
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-5">
          <form onSubmit={submitCode} className="panel flex items-center gap-3 p-4">
            <Barcode className="size-6 text-primary" />
            <Input
              ref={codeRef}
              autoFocus
              className="h-12 flex-1 text-lg"
              inputMode="numeric"
              placeholder="Passe o leitor ou digite o código de barras"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" size="lg">
              Adicionar
            </Button>
          </form>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar produto pelo nome"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {visible.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addLine(product.name, Number(product.price))}
                  className="panel flex h-full flex-col justify-between gap-2 p-4 text-left transition-colors hover:border-primary/60 hover:bg-secondary/60"
                >
                  <span className="line-clamp-2 font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {product.barcode ? `#${product.barcode}` : product.unit}
                  </span>
                  <span className="text-lg font-semibold text-primary">
                    {formatBRL(Number(product.price))}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="panel p-6 text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda.{" "}
              <Link to="/produtos" className="text-primary underline">
                Cadastrar produtos com código de barras
              </Link>
              .
            </div>
          )}

          <div className="panel space-y-3 p-4">
            <Label>Item sem cadastro</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-40 flex-1"
                placeholder="Descrição (opcional)"
                value={freeName}
                onChange={(e) => setFreeName(e.target.value)}
              />
              <Input
                className="w-28"
                inputMode="decimal"
                placeholder="0,00"
                value={freePrice}
                onChange={(e) => setFreePrice(e.target.value)}
              />
              <Button type="button" variant="secondary" onClick={addFreeItem}>
                <Plus className="size-4" /> Incluir
              </Button>
            </div>
          </div>

          {isGuest ? (
            <PixSetupPanel
              settings={settings}
              onSave={(values) => setSettings(saveLocalSettings(values))}
            />
          ) : null}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Carrinho</h2>
              <Badge variant="outline" className="ml-auto">
                {qtyCount} {qtyCount === 1 ? "item" : "itens"}
              </Badge>
            </div>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Passe um código de barras ou toque num produto.
                </p>
              ) : (
                lines.map((line) => (
                  <div key={line.key} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.qty} × {formatBRL(line.price)}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => changeQty(line.key, -1)}>
                      <Minus className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => changeQty(line.key, 1)}>
                      <Plus className="size-4" />
                    </Button>
                    <span className="w-20 text-right text-sm font-semibold">
                      {formatBRL(line.qty * line.price)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setLines(lines.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-3xl font-semibold">{formatBRL(total)}</span>
              </div>

              <Input
                placeholder="Cliente (opcional)"
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

              <Button className="w-full" size="lg" disabled={busy || !lines.length} onClick={checkout}>
                Finalizar e gerar cobrança
              </Button>
              {lines.length ? (
                <Button className="w-full" variant="ghost" onClick={() => setLines([])}>
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
    <div className="panel space-y-3 p-5">
      <h2 className="font-display text-lg font-semibold">Dados da loja (neste aparelho)</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Nome da loja</Label>
          <Input
            value={form.store_name}
            onChange={(e) => setForm({ ...form, store_name: e.target.value })}
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
          toast.success("Dados salvos neste aparelho.");
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
          <PixQr payload={order.pix_payload} className="size-48 rounded-xl bg-white p-3" />
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
        Esta venda não foi salva. Crie sua conta para guardar o histórico e o caixa.
        <Button className="mt-2 w-full" size="sm" onClick={onSignIn}>
          <UserPlus className="size-4" /> Criar conta com Google
        </Button>
      </div>
    </div>
  );
}
