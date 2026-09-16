import { useState } from "react";
import { Keyboard, Check, SlidersHorizontal, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHORTCUT_DEFINITIONS,
  AVAILABLE_SHORTCUT_KEYS,
  loadShortcutsConfig,
  saveShortcutsConfig,
  type ShortcutActionId,
} from "@/lib/keyboard-shortcuts";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigChange?: () => void;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
  onConfigChange,
}: KeyboardShortcutsModalProps) {
  const [config, setConfig] = useState<Record<ShortcutActionId, string>>(() =>
    loadShortcutsConfig(),
  );
  const [isEditing, setIsEditing] = useState(false);

  function handleKeyChange(actionId: ShortcutActionId, newKey: string) {
    const updated = saveShortcutsConfig({ [actionId]: newKey });
    setConfig(loadShortcutsConfig());
    onConfigChange?.();
    toast.success(`Atalho de "${actionId}" alterado para ${newKey}`);
  }

  function handleResetDefaults() {
    const defaults: Record<ShortcutActionId, string> = {
      focus_barcode: "F1",
      open_free_item: "F2",
      open_weigh: "F3",
      checkout: "F4",
      clear_cart: "F8",
      open_shortcuts: "F9",
    };
    saveShortcutsConfig(defaults);
    setConfig(defaults);
    onConfigChange?.();
    toast.success("Atalhos restaurados para o padrão.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Keyboard className="size-5" />
              </span>
              <div>
                <DialogTitle className="font-display text-lg font-bold">
                  Atalhos de Teclado do PDV
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Agilize as vendas no balcão operando direto pelo teclado
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 gap-1.5"
              onClick={() => setIsEditing(!isEditing)}
            >
              <SlidersHorizontal className="size-3.5" />
              {isEditing ? "Ver lista" : "Alterar teclas"}
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-2.5 py-2">
          {SHORTCUT_DEFINITIONS.map((def) => {
            const currentKey = config[def.id] || def.defaultKey;

            return (
              <div
                key={def.id}
                className="panel flex items-center justify-between gap-3 p-3 transition-colors hover:bg-secondary/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{def.label}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    {def.description}
                  </p>
                </div>

                {isEditing ? (
                  <Select
                    value={currentKey}
                    onValueChange={(val) => handleKeyChange(def.id, val)}
                  >
                    <SelectTrigger className="h-8 w-24 text-xs font-mono font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_SHORTCUT_KEYS.map((k) => (
                        <SelectItem key={k} value={k} className="text-xs font-mono">
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <kbd className="grid min-w-10 place-items-center rounded-lg border border-border bg-secondary/80 px-2.5 py-1 font-mono text-xs font-bold text-primary shadow-sm">
                    {currentKey}
                  </kbd>
                )}
              </div>
            );
          })}
        </div>

        {isEditing ? (
          <div className="flex items-center justify-between border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetDefaults}
              className="text-xs text-muted-foreground gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Restaurar padrões
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold"
            >
              Pronto
            </Button>
          </div>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground pt-1">
            Dica: Clique em "Alterar teclas" caso prefira outros atalhos para o seu teclado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
