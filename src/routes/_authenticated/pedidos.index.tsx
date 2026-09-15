import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewOrderDialog } from "@/components/NewOrderDialog";
import { useOrders, useProfile } from "@/hooks/useStore";
import { formatBRL, formatDateTime } from "@/lib/format";
import { orderTotal, STATUS_LABEL, type OrderStatus } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/pedidos/")({
  head: () => ({
    meta: [
      { title: "Pedidos | Comprovante Pix" },
      {
        name: "description",
        content: "Seus pedidos em aberto e pagos, com QR Code Pix e recibos prontos para imprimir.",
      },
      { property: "og:title", content: "Pedidos | Comprovante Pix" },
      { property: "og:description", content: "Gerencie cobranças Pix e recibos de pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

const STATUS_STYLE: Record<OrderStatus, string> = {
  aberto: "bg-warning/15 text-warning border-warning/30",
  pago: "bg-success/15 text-success border-success/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

function OrdersPage() {
  const { data: profile } = useProfile();
  const { data: orders = [], isLoading } = useOrders();
  const [filter, setFilter] = useState<"todos" | OrderStatus>("aberto");
  const [term, setTerm] = useState("");

  const openCount = orders.filter((o) => o.status === "aberto").length;
  const openAmount = orders
    .filter((o) => o.status === "aberto")
    .reduce((acc, o) => acc + orderTotal(o), 0);
  const todayPaid = orders
    .filter(
      (o) =>
        o.status === "pago" && o.paid_at?.slice(0, 10) === new Date().toISOString().slice(0, 10),
    )
    .reduce((acc, o) => acc + orderTotal(o), 0);

  const visible = useMemo(() => {
    const search = term.trim().toLowerCase();
    return orders.filter((order) => {
      const matchStatus = filter === "todos" || order.status === filter;
      const matchTerm =
        !search ||
        order.customer_name.toLowerCase().includes(search) ||
        String(order.order_number).includes(search) ||
        (order.description ?? "").toLowerCase().includes(search);
      return matchStatus && matchTerm;
    });
  }, [orders, filter, term]);

  const limit = profile?.open_order_limit ?? 15;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Pedidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile?.plan === "free"
              ? `${openCount} de ${limit} pedidos em aberto no plano grátis`
              : `${openCount} pedidos em aberto`}
          </p>
        </div>
        {profile ? <NewOrderDialog profile={profile} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Em aberto</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{formatBRL(openAmount)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Recebido hoje</p>
          <p className="mt-1 text-2xl font-semibold text-success">{formatBRL(todayPaid)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Total de pedidos</p>
          <p className="mt-1 text-2xl font-semibold">{orders.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList>
            <TabsTrigger value="aberto">Em aberto</TabsTrigger>
            <TabsTrigger value="pago">Pagos</TabsTrigger>
            <TabsTrigger value="cancelado">Cancelados</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar cliente ou número"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="panel divide-y divide-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Carregando…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Nenhum pedido aqui ainda. Crie o primeiro em “Novo pedido”.
          </p>
        ) : (
          visible.map((order) => (
            <Link
              key={order.id}
              to="/pedidos/$id"
              params={{ id: order.id }}
              className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/60"
            >
              <div className="w-14 shrink-0 font-mono text-sm text-muted-foreground">
                #{String(order.order_number).padStart(4, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{order.customer_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {order.description || "—"} · {formatDateTime(order.created_at)}
                </p>
              </div>
              <Badge variant="outline" className={STATUS_STYLE[order.status]}>
                {STATUS_LABEL[order.status]}
              </Badge>
              <div className="w-28 text-right font-semibold">{formatBRL(orderTotal(order))}</div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
