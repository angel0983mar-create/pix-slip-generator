import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Barcode, Package, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
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
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/useSession";
import {
  useDeleteProduct,
  useImportLocalProducts,
  useProducts,
  useSaveProduct,
} from "@/hooks/useCatalog";
import { loadLocalProducts } from "@/lib/local-store";
import { PRODUCT_UNITS, type Product } from "@/lib/domain";
import { formatBRL, parseAmount } from "@/lib/format";

export const Route = createFileRoute("/produtos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Produtos e códigos de barras | Comprovante Pix" },
      {
        name: "description",
        content:
          "Cadastre produtos com código de barras, preço e unidade para vender rápido no PDV e gerar cobranças Pix.",
      },
      { property: "og:title", content: "Cadastro de produtos com código de barras" },
      {
        property: "og:description",
        content: "Monte seu catálogo e venda com leitor de código de barras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

const EMPTY = { id: "", name: "", barcode: "", price: "", unit: "un", category: "" };

function ProductsPage() {
  const { user, loading } = useSession();
  const isGuest = !loading && !user;
  const { data: products = [], isLoading } = useProducts();
  const save = useSaveProduct();
  const remove = useDeleteProduct();
  const importLocal = useImportLocalProducts();
  const [form, setForm] = useState(EMPTY);
  const [term, setTerm] = useState("");

  const pendingLocal = !isGuest && !loading ? loadLocalProducts().length : 0;

  const visible = useMemo(() => {
    const search = term.trim().toLowerCase();
    if (!search) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(search) || (p.barcode ?? "").includes(search),
    );
  }, [products, term]);

  function edit(product: Product) {
    setForm({
      id: product.id,
      name: product.name,
      barcode: product.barcode ?? "",
      price: String(product.price).replace(".", ","),
      unit: product.unit,
      category: product.category ?? "",
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    try {
      await save.mutateAsync({
        id: form.id || undefined,
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        price: parseAmount(form.price),
        unit: form.unit,
        category: form.category.trim() || null,
        active: true,
      });
      toast.success(form.id ? "Produto atualizado." : "Produto cadastrado.");
      setForm(EMPTY);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
              C
            </span>
            <span className="font-display text-lg font-semibold">Produtos</span>
          </Link>
          <Button className="ml-auto" variant="secondary" size="sm" asChild>
            <Link to="/pdv">
              <Barcode className="size-4" /> Ir para o PDV
            </Link>
          </Button>
          {isGuest ? (
            <Button
              size="sm"
              onClick={() =>
                lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })
              }
            >
              <UserPlus className="size-4" /> Criar conta com Google
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[360px_1fr]">
        <form onSubmit={submit} className="panel h-fit space-y-4 p-5">
          <h1 className="font-display text-xl font-semibold">
            {form.id ? "Editar produto" : "Novo produto"}
          </h1>

          <div className="space-y-1">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Arroz 5kg"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="codigo">Código de barras</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              placeholder="Passe o leitor aqui"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="preco">Preço</Label>
              <Input
                id="preco"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>Unidade</Label>
              <Select value={form.unit} onValueChange={(value) => setForm({ ...form, unit: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cat">Categoria (opcional)</Label>
            <Input
              id="cat"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Mercearia, bebidas…"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={save.isPending}>
              {form.id ? "Salvar" : "Cadastrar"}
            </Button>
            {form.id ? (
              <Button type="button" variant="ghost" onClick={() => setForm(EMPTY)}>
                Cancelar
              </Button>
            ) : null}
          </div>

          {isGuest ? (
            <p className="text-xs text-muted-foreground">
              Sem conta, o catálogo fica salvo apenas neste aparelho.
            </p>
          ) : null}
        </form>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-xs"
              placeholder="Buscar por nome ou código"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <Badge variant="outline">{products.length} produtos</Badge>
          </div>

          {pendingLocal ? (
            <div className="panel flex flex-wrap items-center gap-3 p-4 text-sm">
              <span>
                {pendingLocal} produto(s) salvos neste aparelho antes do login. Quer enviar para sua
                conta?
              </span>
              <Button
                size="sm"
                onClick={async () => {
                  const count = await importLocal.mutateAsync();
                  toast.success(`${count} produto(s) enviados para sua conta.`);
                }}
                disabled={importLocal.isPending}
              >
                Enviar agora
              </Button>
            </div>
          ) : null}

          <div className="panel divide-y divide-border">
            {isLoading ? (
              <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
            ) : visible.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nenhum produto ainda. Cadastre o primeiro ao lado.
              </p>
            ) : (
              visible.map((product) => (
                <div key={product.id} className="flex items-center gap-3 p-4">
                  <Package className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {product.barcode ? `#${product.barcode}` : "sem código"} · {product.unit}
                      {product.category ? ` · ${product.category}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold">{formatBRL(Number(product.price))}</span>
                  <Button size="icon" variant="ghost" onClick={() => edit(product)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await remove.mutateAsync(product.id);
                      toast.success("Produto removido.");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
