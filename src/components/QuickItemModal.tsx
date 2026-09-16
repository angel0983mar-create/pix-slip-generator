import { useState, useRef, useEffect } from "react";
import { Plus, Tag, CornerDownLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAmount } from "@/lib/format";
import { toast } from "sonner";

interface QuickItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddItem: (name: string, price: number, note?: string) => void;
}

export function QuickItemModal({ open, onOpenChange, onAddItem }: QuickItemModalProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setPrice("");
      setNote("");
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmount(price);
    if (amount <= 0) {
      toast.error("Informe um valor válido maior que zero.");
      priceInputRef.current?.focus();
      return;
    }

    const itemName = name.trim() || "Item avulso";
    onAddItem(itemName, amount, note.trim() || undefined);
    onOpenChange(false);
    toast.success(`Adicionado: ${itemName}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/20 text-primary">
              <Plus className="size-4" />
            </span>
            <DialogTitle className="font-display text-lg font-bold">
              Item Avulso (Sem Cadastro)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Lance rapidamente um valor ou produto avulso direto no carrinho
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="quick-price">Valor (R$)*</Label>
            <Input
              id="quick-price"
              ref={priceInputRef}
              inputMode="decimal"
              placeholder="0,00"
              className="text-lg font-bold h-11"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-name">Descrição do produto / serviço (opcional)</Label>
            <Input
              id="quick-name"
              placeholder="Ex: Pão caseiro, Recarga, Mão de obra"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quick-note">Observação adicional (opcional)</Label>
            <Input
              id="quick-note"
              placeholder="Ex: sem açúcar, 220V, cliente retirou"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="gap-1.5 font-semibold">
              <CornerDownLeft className="size-4" /> Incluir no Carrinho
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
