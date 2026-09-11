import { formatBRL, formatDateTime } from "./format";
import { orderTotal, paymentLabel, type DocMode, type Order, type Profile } from "./domain";

/**
 * Desenha o comprovante/recibo em uma imagem PNG (para enviar no WhatsApp).
 */
export async function buildReceiptImage(params: {
  order: Order;
  profile: Profile;
  mode: DocMode;
  qrDataUrl?: string | null;
}): Promise<string> {
  const { order, profile, mode, qrDataUrl } = params;
  const isRecibo = mode === "recibo";
  const total = orderTotal(order);

  const W = 760;
  const PAD = 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  let qrImg: HTMLImageElement | null = null;
  if (!isRecibo && qrDataUrl) {
    qrImg = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = qrDataUrl;
    });
  }

  const lines: { text: string; label?: string }[] = [
    { label: "Cliente", text: order.customer_name },
  ];
  if (order.customer_contact) lines.push({ label: "Contato", text: order.customer_contact });
  if (order.description) lines.push({ label: "Referente a", text: order.description });
  lines.push({ label: "Forma de pagamento", text: paymentLabel(order.payment_method) });
  lines.push({
    label: isRecibo ? "Pago em" : "Emitido em",
    text: formatDateTime(isRecibo ? (order.paid_at ?? order.updated_at) : order.created_at),
  });

  const itemsCount = order.items?.length ?? 0;
  const qrBlock = qrImg ? 300 + 70 : 0;
  const H = 300 + lines.length * 34 + itemsCount * 30 + qrBlock + (order.notes ? 60 : 0) + 140;

  canvas.width = W;
  canvas.height = H;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // faixa superior
  ctx.fillStyle = isRecibo ? "#0f766e" : "#0f172a";
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px Helvetica, Arial, sans-serif";
  ctx.fillText(profile.store_name.slice(0, 30), PAD, 46);
  ctx.font = "16px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#d1fae5";
  ctx.fillText(
    [profile.merchant_name, profile.phone, profile.city].filter(Boolean).join(" • ").slice(0, 60),
    PAD,
    72,
  );

  let y = 148;
  ctx.fillStyle = "#111827";
  ctx.font = "bold 24px Helvetica, Arial, sans-serif";
  ctx.fillText(isRecibo ? "RECIBO DE PAGAMENTO" : "COBRANÇA / PEDIDO", PAD, y);
  ctx.font = "16px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`Nº ${String(order.order_number).padStart(5, "0")}`, W - PAD - 110, y);

  y += 22;
  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 34;

  for (const line of lines) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "15px Helvetica, Arial, sans-serif";
    ctx.fillText(`${line.label}:`, PAD, y);
    ctx.fillStyle = "#111827";
    ctx.font = "bold 16px Helvetica, Arial, sans-serif";
    ctx.fillText(line.text.slice(0, 46), PAD + 190, y);
    y += 34;
  }

  if (itemsCount) {
    y += 6;
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Helvetica, Arial, sans-serif";
    ctx.fillText("ITENS", PAD, y);
    y += 24;
    for (const item of order.items) {
      ctx.fillStyle = "#111827";
      ctx.font = "15px Helvetica, Arial, sans-serif";
      ctx.fillText(`${item.qty}x ${item.name}`.slice(0, 44), PAD, y);
      const value = formatBRL(item.qty * item.price);
      ctx.fillText(value, W - PAD - ctx.measureText(value).width, y);
      y += 30;
    }
  }

  y += 14;
  ctx.fillStyle = isRecibo ? "#ecfdf5" : "#f3f4f6";
  ctx.fillRect(PAD, y - 26, W - PAD * 2, 62);
  ctx.fillStyle = "#374151";
  ctx.font = "16px Helvetica, Arial, sans-serif";
  ctx.fillText(isRecibo ? "Valor recebido" : "Valor a pagar", PAD + 16, y + 2);
  ctx.fillStyle = isRecibo ? "#047857" : "#111827";
  ctx.font = "bold 30px Helvetica, Arial, sans-serif";
  const totalText = formatBRL(total);
  ctx.fillText(totalText, W - PAD - 16 - ctx.measureText(totalText).width, y + 8);
  y += 70;

  if (isRecibo) {
    ctx.strokeStyle = "#047857";
    ctx.lineWidth = 3;
    ctx.strokeRect(PAD, y, 140, 44);
    ctx.fillStyle = "#047857";
    ctx.font = "bold 24px Helvetica, Arial, sans-serif";
    ctx.fillText("PAGO", PAD + 32, y + 31);
    y += 66;
  }

  if (qrImg) {
    ctx.fillStyle = "#111827";
    ctx.font = "bold 17px Helvetica, Arial, sans-serif";
    ctx.fillText("Pague com Pix — aponte a câmera", PAD, y);
    y += 16;
    ctx.drawImage(qrImg, (W - 300) / 2, y, 300, 300);
    y += 330;
  }

  if (order.notes) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px Helvetica, Arial, sans-serif";
    ctx.fillText(`Obs.: ${order.notes.slice(0, 70)}`, PAD, y);
    y += 34;
  }

  ctx.fillStyle = "#9ca3af";
  ctx.font = "14px Helvetica, Arial, sans-serif";
  const foot = profile.receipt_footer || "Obrigado pela preferência!";
  ctx.fillText(foot.slice(0, 70), PAD, H - 34);

  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
