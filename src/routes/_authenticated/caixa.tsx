import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrders, useProfile } from "@/hooks/useStore";
import { formatBRL, formatDateTime } from "@/lib/format";
import { orderTotal, PAYMENT_METHODS, paymentLabel } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa do dia | Comprovante Pix" },
      {
        name: "description",
        content: "Fechamento de caixa: total recebido por forma de pagamento e pedidos em aberto.",
      },
      { property: "og:title", content: "Caixa do dia | Comprovante Pix" },
      {
        property: "og:description",
        content: "Veja o total recebido no dia e o que falta receber.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashPage,
});

function CashPage() {
  const { data: orders = [] } = useOrders();
  const { data: profile } = useProfile();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const paidToday = useMemo(
    () => orders.filter((o) => o.status === "pago" && o.paid_at?.slice(0, 10) === day),
    [orders, day],
  );

  const total = paidToday.reduce((acc, o) => acc + orderTotal(o), 0);
  const open = orders.filter((o) => o.status === "aberto");
  const openTotal = open.reduce((acc, o) => acc + orderTotal(o), 0);

  const byMethod = PAYMENT_METHODS.map((method) => ({
    label: method.label,
    value: paidToday
      .filter((o) => o.payment_method === method.value)
      .reduce((acc, o) => acc + orderTotal(o), 0),
  })).filter((row) => row.value > 0);

  function printSummary() {
    const win = window.open("", "_blank", "width=700,height=800");
    if (!win) return;
    const rows = paidToday
      .map(
        (o) =>
          `<tr><td>#${String(o.order_number).padStart(4, "0")}</td><td>${o.customer_name}</td><td>${paymentLabel(
            o.payment_method,
          )}</td><td style="text-align:right">${formatBRL(orderTotal(o))}</td></tr>`,
      )
      .join("");
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
      <title>Fechamento de caixa</title>
      <style>@page{size:${profile?.print_layout === "cupom" ? "80mm auto" : "A4"};margin:${
        profile?.print_layout === "cupom" ? "3mm" : "16mm"
      }}
      body{font-family:${profile?.print_layout === "cupom" ? '"Courier New",monospace' : "Helvetica,Arial,sans-serif"};color:#111;font-size:${
        profile?.print_layout === "cupom" ? "11px" : "13px"
      }}
      h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px}
      td,th{padding:4px 2px;border-bottom:1px dashed #bbb;text-align:left}
      .tot{font-size:20px;font-weight:700;margin-top:10px;text-align:right}</style></head><body>
      <h1>${profile?.store_name ?? "Caixa"}</h1>
      <div>Fechamento de caixa — ${new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR")}</div>
      <table><thead><tr><th>Nº</th><th>Cliente</th><th>Forma</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">Nenhum recebimento neste dia.</td></tr>'}</tbody></table>
      <div class="tot">Total recebido: ${formatBRL(total)}</div>
      <div style="margin-top:8px">Em aberto no momento: ${formatBRL(openTotal)} (${open.length} pedidos)</div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Caixa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recebimentos confirmados e pedidos que ainda faltam receber.
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="dia">Dia</Label>
            <Input id="dia" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={printSummary}>
            <Printer className="size-4" /> Imprimir fechamento
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Recebido no dia</p>
          <p className="mt-1 text-2xl font-semibold text-success">{formatBRL(total)}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">Pedidos pagos</p>
          <p className="mt-1 text-2xl font-semibold">{paidToday.length}</p>
        </div>
        <div className="panel p-5">
          <p className="text-sm text-muted-foreground">A receber (em aberto)</p>
          <p className="mt-1 text-2xl font-semibold text-warning">{formatBRL(openTotal)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Por forma de pagamento</h2>
          {byMethod.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum recebimento neste dia.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {byMethod.map((row) => (
                <li key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{formatBRL(row.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-6">
          <h2 className="font-display text-lg font-semibold">Recebimentos do dia</h2>
          {paidToday.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {paidToday.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(order.paid_at)} · {paymentLabel(order.payment_method)}
                    </p>
                  </div>
                  <span className="font-semibold">{formatBRL(orderTotal(order))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
