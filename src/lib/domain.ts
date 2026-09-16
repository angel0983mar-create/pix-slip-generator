export type OrderStatus = "aberto" | "pago" | "cancelado";
export type PrintLayout = "a4" | "cupom";
export type DocMode = "cobranca" | "recibo";

export interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: number;
  customer_name: string;
  customer_contact: string | null;
  description: string | null;
  items: OrderItem[];
  amount: number;
  status: OrderStatus;
  payment_method: string;
  pix_payload: string | null;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  price: number;
  unit: string;
  category: string | null;
  active: boolean;
}

export const PRODUCT_UNITS = [
  { value: "un", label: "Unidade" },
  { value: "kg", label: "Quilo" },
  { value: "l", label: "Litro" },
  { value: "cx", label: "Caixa" },
  { value: "pct", label: "Pacote" },
] as const;

export interface Profile {
  id: string;
  store_name: string;
  merchant_name: string;
  city: string;
  phone: string | null;
  document: string | null;
  pix_key: string | null;
  pix_key_type: string;
  print_layout: PrintLayout;
  receipt_footer: string | null;
  business_branch?: string;
  store_logo_url?: string | null;
  plan: string;
  open_order_limit: number;
  next_order_number: number;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aberto: "Em aberto",
  pago: "Pago",
  cancelado: "Cancelado",
};

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_debito", label: "Cartão de débito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
] as const;

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;
}

export function orderTotal(order: Pick<Order, "amount" | "items">): number {
  if (order.items?.length) {
    const sum = order.items.reduce((acc, item) => acc + item.qty * item.price, 0);
    if (sum > 0) return sum;
  }
  return Number(order.amount) || 0;
}
