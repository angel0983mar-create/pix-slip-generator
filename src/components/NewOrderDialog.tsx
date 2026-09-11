import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAYMENT_METHODS, type OrderItem, type Profile } from "@/lib/domain";
import { buildPixPayload } from "@/lib/pix";
import { formatBRL, parseAmount } from "@/lib/format";
import { friendlyError } from "@/hooks/useStore";

export function NewOrderDialog({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("pix");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const itemsTotal = items.reduce((acc, item) => acc + item.qty * item.price, 0);
  const total = items.length ? itemsTotal : parseAmount(amount);

  function reset() {
    setCustomerName("");
    setContact("");
    setDescription("");
    setAmount("");
    setMethod("pix");
    setDueDate("");
    setNotes("");
    setItems([]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (total <= 0) {
      toast.error("Informe o valor do pedido.");
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada");

      const { data: created, error } = await supabase
        .from("orders")
        .insert({
          user_id: uid,
          customer_name: customerName.trim() || "Cliente",
          customer_contact: contact.trim() || null,
          description: description.trim() || null,
          items: items as unknown as never,
          amount: total,
          payment_method: method,
          due_date: dueDate || null,
          notes: notes.trim() || null,
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
          description: description,
        });
        await supabase.from("orders").update({ pix_payload: payload }).eq("id", created.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Pedido nº ${String(created.order_number).padStart(5, "0")} criado.`);
      reset();
      setOpen(false);
      navigate({ to: "/pedidos/$id", params: { id: created.id } });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus className="size-4" /> Novo pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            Preencha os dados da cobrança. O QR Code Pix é gerado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <Input
              id="cliente"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome de quem vai pagar"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contato">WhatsApp ou e-mail</Label>
              <Input
                id="contato"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="(11) 99999-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venc">Vencimento</Label>
              <Input
                id="venc"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Referente a</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: 2 marmitas + refrigerante"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor total</Label>
              <Input
                id="valor"
                inputMode="decimal"
                value={items.length ? formatBRL(itemsTotal) : amount}
                disabled={items.length > 0}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
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
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between">
              <Label>Itens (opcional)</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setItems([...items, { name: "", qty: 1, price: 0 }])}
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="Descrição"
                  value={item.name}
                  onChange={(e) =>
                    setItems(items.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)))
                  }
                />
                <Input
                  className="w-16"
                  inputMode="numeric"
                  value={item.qty}
                  onChange={(e) =>
                    setItems(
                      items.map((it, i) =>
                        i === index ? { ...it, qty: Math.max(1, Number(e.target.value) || 1) } : it,
                      ),
                    )
                  }
                />
                <Input
                  className="w-24"
                  inputMode="decimal"
                  placeholder="0,00"
                  onChange={(e) =>
                    setItems(
                      items.map((it, i) =>
                        i === index ? { ...it, price: parseAmount(e.target.value) } : it,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setItems(items.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {method === "pix" && !profile.pix_key ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              Cadastre sua chave Pix em Configurações para o QR Code ser gerado.
            </p>
          ) : null}

          <DialogFooter className="items-center gap-3 sm:justify-between">
            <span className="text-sm text-muted-foreground">
              Total: <strong className="text-foreground">{formatBRL(total)}</strong>
            </span>
            <Button type="submit" disabled={busy}>
              Criar pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
