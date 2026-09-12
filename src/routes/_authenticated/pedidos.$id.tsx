import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Copy,
  ImageDown,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePixQr } from "@/components/PixQr";
import { useOrder, useProfile } from "@/hooks/useStore";
import { formatBRL, formatDate, formatDateTime, onlyDigits } from "@/lib/format";
import { orderTotal, paymentLabel, STATUS_LABEL, type DocMode, type PrintLayout } from "@/lib/domain";
import { printReceipt } from "@/lib/receipt";
import { buildReceiptImage, downloadDataUrl } from "@/lib/receipt-image";
import { buildPixPayload } from "@/lib/pix";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({
    meta: [
      { title: "Pedido | Comprovante Pix" },
      {
        name: "description",
        content: "QR Code Pix, recibo de pagamento em PDF, imagem e impressão em cupom 80mm.",
      },
      { property: "og:title", content: "Pedido | Comprovante Pix" },
      { property: "og:description", content: "Cobrança Pix e recibo de pagamento do pedido." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: order, isLoading } = useOrder(id);
  const [layout, setLayout] = useState<PrintLayout | null>(null);
  const [busy, setBusy] = useState(false);

  const activeLayout: PrintLayout = layout ?? profile?.print_layout ?? "a4";
  const qrDataUrl = usePixQr(order?.pix_payload ?? null);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!order || !profile) return <p className="text-sm text-muted-foreground">Pedido não encontrado.</p>;

  const total = orderTotal(order);
  const isPaid = order.status === "pago";
  const mode: DocMode = isPaid ? "recibo" : "cobranca";

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["order", id] });
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  async function setStatus(status: "aberto" | "pago" | "cancelado") {
    setBusy(true);
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success(
      status === "pago"
        ? "Pagamento confirmado. O recibo já está pronto."
        : status === "cancelado"
          ? "Pedido cancelado."
          : "Pedido reaberto.",
    );
  }

  async function regeneratePix() {
    const store = profile!;
    if (!store.pix_key) {
      toast.error("Cadastre sua chave Pix em Configurações.");
      return;
    }
    const payload = buildPixPayload({
      key: store.pix_key,
      keyType: store.pix_key_type,
      merchantName: store.merchant_name || store.store_name,
      city: store.city,
      amount: total,
      txid: `PED${String(order!.order_number).padStart(5, "0")}`,
      description: order!.description ?? "",
    });
    const { error } = await supabase.from("orders").update({ pix_payload: payload }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    toast.success("QR Code Pix gerado.");
  }

  async function copyPix() {
    if (!order?.pix_payload) return;
    await navigator.clipboard.writeText(order.pix_payload);
    toast.success("Pix Copia e Cola copiado.");
  }

  function handlePrint(docMode: DocMode) {
    const ok = printReceipt({ order: order!, profile: profile!, mode: docMode, layout: activeLayout, qrDataUrl });
    if (!ok) {
      toast.error("Libere as janelas pop-up do navegador para imprimir ou salvar em PDF.");
    }
  }

  async function handleImage(docMode: DocMode) {
    setBusy(true);
    try {
      const dataUrl = await buildReceiptImage({ order: order!, profile: profile!, mode: docMode, qrDataUrl });
      downloadDataUrl(
        dataUrl,
        `${docMode === "recibo" ? "recibo" : "cobranca"}-${String(order!.order_number).padStart(5, "0")}.png`,
      );
      toast.success("Imagem baixada. Já pode enviar no WhatsApp.");
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  function sendWhatsApp() {
    const lines = [
      `*${profile!.store_name}*`,
      isPaid
        ? `Recibo do pedido nº ${String(order!.order_number).padStart(5, "0")} — pagamento de ${formatBRL(total)} confirmado. Obrigado!`
        : `Cobrança nº ${String(order!.order_number).padStart(5, "0")} — valor ${formatBRL(total)}${
            order!.due_date ? `, vencimento ${formatDate(order!.due_date)}` : ""
          }.`,
      order!.description ? `Referente a: ${order!.description}` : "",
      !isPaid && order!.pix_payload ? `\nPix Copia e Cola:\n${order!.pix_payload}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const phone = onlyDigits(order!.customer_contact ?? "");
    const target = phone.length >= 10 ? `55${phone.slice(-11)}` : "";
    window.open(
      `https://wa.me/${target}?text=${encodeURIComponent(lines)}`,
      "_blank",
      "noopener",
    );
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("orders").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refresh();
    navigate({ to: "/pedidos" });
  }

  return (
    <div className="space-y-6">
      <Link
        to="/pedidos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Todos os pedidos
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">
            Pedido nº {String(order.order_number).padStart(5, "0")}
          </p>
          <h1 className="text-3xl font-semibold">{order.customer_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Criado em {formatDateTime(order.created_at)} · {paymentLabel(order.payment_method)}
          </p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className={isPaid ? "border-success/40 bg-success/15 text-success" : ""}>
            {STATUS_LABEL[order.status]}
          </Badge>
          <p className="mt-2 text-3xl font-semibold">{formatBRL(total)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="panel space-y-4 p-6">
          <h2 className="font-display text-lg font-semibold">
            {isPaid ? "Recibo de pagamento" : "Cobrança"}
          </h2>

          <dl className="space-y-2 text-sm">
            <Row label="Cliente" value={order.customer_name} />
            <Row label="Contato" value={order.customer_contact || "—"} />
            <Row label="Referente a" value={order.description || "—"} />
            <Row label="Vencimento" value={order.due_date ? formatDate(order.due_date) : "—"} />
            <Row label="Pago em" value={order.paid_at ? formatDateTime(order.paid_at) : "—"} />
            <Row label="Observações" value={order.notes || "—"} />
          </dl>

          {order.items?.length ? (
            <>
              <Separator />
              <ul className="space-y-1 text-sm">
                {order.items.map((item, index) => (
                  <li key={index} className="flex justify-between">
                    <span>
                      {item.qty}x {item.name}
                    </span>
                    <span>{formatBRL(item.qty * item.price)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Layout de impressão</span>
              <Select value={activeLayout} onValueChange={(value) => setLayout(value as PrintLayout)}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">Impressora normal (A4)</SelectItem>
                  <SelectItem value="cupom">Impressora de cupom (80mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => handlePrint(mode)}>
                <Printer className="size-4" />
                {isPaid ? "Imprimir / salvar recibo em PDF" : "Imprimir / salvar cobrança em PDF"}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => handleImage(mode)}>
                <ImageDown className="size-4" /> Baixar imagem
              </Button>
              <Button variant="secondary" onClick={sendWhatsApp}>
                <Send className="size-4" /> Enviar no WhatsApp
              </Button>
            </div>

            {isPaid ? (
              <Button variant="ghost" size="sm" onClick={() => handlePrint("cobranca")}>
                Imprimir também a cobrança original
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="panel p-6">
            <h2 className="font-display text-lg font-semibold">Pagamento</h2>
            {order.pix_payload ? (
              <div className="mt-4 flex flex-col items-center gap-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code Pix do pedido"
                    className="size-56 rounded-xl bg-white p-3"
                  />
                ) : null}
                <Button variant="secondary" className="w-full" onClick={copyPix}>
                  <Copy className="size-4" /> Copiar Pix Copia e Cola
                </Button>
                <p className="max-h-24 w-full overflow-y-auto rounded-lg border border-border bg-background/60 p-2 font-mono text-[10px] break-all text-muted-foreground">
                  {order.pix_payload}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Este pedido ainda não tem QR Code Pix.
                </p>
                <Button variant="secondary" onClick={regeneratePix}>
                  Gerar QR Code Pix
                </Button>
              </div>
            )}
          </div>

          <div className="panel space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold">Situação</h2>
            {isPaid ? (
              <Button variant="secondary" disabled={busy} onClick={() => setStatus("aberto")}>
                Reabrir pedido
              </Button>
            ) : (
              <Button className="w-full" disabled={busy} onClick={() => setStatus("pago")}>
                <BadgeCheck className="size-4" /> Marcar como pago
              </Button>
            )}
            {order.status !== "cancelado" && !isPaid ? (
              <Button variant="ghost" disabled={busy} onClick={() => setStatus("cancelado")}>
                <XCircle className="size-4" /> Cancelar pedido
              </Button>
            ) : null}
            <Button variant="ghost" className="text-destructive" disabled={busy} onClick={remove}>
              <Trash2 className="size-4" /> Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
