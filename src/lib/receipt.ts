import { formatBRL, formatDate, formatDateTime } from "./format";
import {
  orderTotal,
  paymentLabel,
  type DocMode,
  type Order,
  type PrintLayout,
  type Profile,
} from "./domain";

export interface ReceiptContext {
  order: Order;
  profile: Profile;
  mode: DocMode;
  layout: PrintLayout;
  qrDataUrl?: string | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemRows(order: Order): string {
  if (!order.items?.length) return "";
  return order.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="num">${item.qty}</td>
        <td class="num">${formatBRL(item.price)}</td>
        <td class="num">${formatBRL(item.qty * item.price)}</td>
      </tr>`,
    )
    .join("");
}

export function buildReceiptHtml(ctx: ReceiptContext): string {
  const { order, profile, mode, layout, qrDataUrl } = ctx;
  const total = orderTotal(order);
  const isRecibo = mode === "recibo";
  const cupom = layout === "cupom";

  const title = isRecibo ? "RECIBO DE PAGAMENTO" : "COBRANÇA / PEDIDO";
  const docNumber = String(order.order_number).padStart(5, "0");

  const page = cupom
    ? "@page { size: 80mm auto; margin: 3mm; }"
    : "@page { size: A4; margin: 16mm; }";

  const body = cupom ? "width: 74mm; font-size: 11px;" : "max-width: 178mm; font-size: 13px;";

  const items = itemRows(order);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${isRecibo ? "Recibo" : "Cobranca"} ${docNumber} - ${escapeHtml(profile.store_name)}</title>
<style>
  ${page}
  * { box-sizing: border-box; }
  body { margin: 0 auto; ${body} font-family: ${cupom ? '"Courier New", monospace' : "Helvetica, Arial, sans-serif"}; color: #111; }
  h1 { font-size: ${cupom ? "13px" : "20px"}; margin: 0 0 2px; letter-spacing: .5px; }
  .muted { color: #555; }
  .center { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  .head { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; ${cupom ? "text-align:center;" : ""} }
  .badge { display: inline-block; border: 2px solid #111; padding: ${cupom ? "2px 6px" : "4px 10px"}; font-weight: 700; letter-spacing: 1px; }
  .box { border: 1px solid #999; padding: 8px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { text-align: left; padding: ${cupom ? "3px 2px" : "6px 4px"}; border-bottom: 1px dashed #bbb; }
  th { border-bottom: 1px solid #111; font-size: ${cupom ? "10px" : "12px"}; text-transform: uppercase; }
  .num { text-align: right; white-space: nowrap; }
  .total { font-size: ${cupom ? "15px" : "22px"}; font-weight: 700; }
  .pix { font-family: "Courier New", monospace; font-size: ${cupom ? "7px" : "9px"}; word-break: break-all; border: 1px dashed #666; padding: 6px; }
  .qr { display: block; margin: 8px auto; width: ${cupom ? "45mm" : "42mm"}; height: auto; }
  .sign { margin-top: ${cupom ? "18px" : "42px"}; border-top: 1px solid #111; padding-top: 4px; text-align: center; }
  .foot { margin-top: 10px; font-size: ${cupom ? "9px" : "11px"}; color: #555; text-align: center; }
  .dash { border-top: 1px dashed #666; margin: 8px 0; }
</style>
</head>
<body>
  <div class="head">
    <h1>${escapeHtml(profile.store_name)}</h1>
    <div class="muted">${escapeHtml(
      [profile.merchant_name, profile.document, profile.phone, profile.city]
        .filter(Boolean)
        .join(" • "),
    )}</div>
  </div>

  <div class="${cupom ? "center" : "row"}">
    <div><span class="badge">${title}</span></div>
    <div class="muted">Nº ${docNumber}<br />Emitido em ${escapeHtml(formatDateTime(order.created_at))}</div>
  </div>

  <div class="box">
    <div><strong>Cliente:</strong> ${escapeHtml(order.customer_name)}</div>
    ${order.customer_contact ? `<div><strong>Contato:</strong> ${escapeHtml(order.customer_contact)}</div>` : ""}
    ${order.description ? `<div><strong>Referente a:</strong> ${escapeHtml(order.description)}</div>` : ""}
    ${!isRecibo && order.due_date ? `<div><strong>Vencimento:</strong> ${escapeHtml(formatDate(order.due_date))}</div>` : ""}
    <div><strong>Forma de pagamento:</strong> ${escapeHtml(paymentLabel(order.payment_method))}</div>
    ${isRecibo ? `<div><strong>Pago em:</strong> ${escapeHtml(formatDateTime(order.paid_at ?? order.updated_at))}</div>` : ""}
  </div>

  ${
    items
      ? `<table>
          <thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead>
          <tbody>${items}</tbody>
        </table>`
      : '<div class="dash"></div>'
  }

  <div class="row" style="align-items:flex-end; margin-top:6px;">
    <div class="muted">${isRecibo ? "Valor recebido" : "Valor a pagar"}</div>
    <div class="total">${formatBRL(total)}</div>
  </div>

  ${
    isRecibo
      ? `<p style="margin-top:10px">Recebi(emos) de <strong>${escapeHtml(order.customer_name)}</strong> a
         importância de <strong>${formatBRL(total)}</strong>${
           order.description ? ` referente a ${escapeHtml(order.description)}` : ""
         }, dando plena quitação deste valor.</p>
         <div class="badge center" style="display:block; margin-top:8px;">PAGO</div>`
      : qrDataUrl
        ? `<div class="center" style="margin-top:10px"><strong>Pague com Pix</strong></div>
           <img class="qr" src="${qrDataUrl}" alt="QR Code Pix" />
           <div class="pix">${escapeHtml(order.pix_payload ?? "")}</div>`
        : ""
  }

  ${order.notes ? `<div class="box"><strong>Observações:</strong> ${escapeHtml(order.notes)}</div>` : ""}

  ${isRecibo && !cupom ? `<div class="sign">${escapeHtml(profile.merchant_name || profile.store_name)}</div>` : ""}

  <div class="foot">${escapeHtml(profile.receipt_footer || "Obrigado pela preferência!")}</div>
  <div class="foot">${escapeHtml(profile.receipt_footer || "Obrigado pela preferência!")}</div>
</body>
</html>`;
}

/**
 * Imprime usando um iframe oculto (funciona mesmo quando o app roda dentro de
 * um iframe/pré-visualização, onde window.open costuma ser bloqueado).
 */
export function printReceipt(ctx: ReceiptContext): boolean {
  try {
    const html = buildReceiptHtml(ctx);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.style.visibility = "hidden";
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    if (!doc) {
      frame.remove();
      return false;
    }
    doc.open();
    doc.write(html);
    doc.close();

    const run = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        /* ignora */
      }
      window.setTimeout(() => frame.remove(), 60000);
    };

    if (doc.readyState === "complete") window.setTimeout(run, 250);
    else frame.onload = () => window.setTimeout(run, 250);

    return true;
  } catch {
    return false;
  }
}

