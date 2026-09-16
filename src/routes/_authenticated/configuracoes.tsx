import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Keyboard, SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useProfile, useUpdateProfile } from "@/hooks/useStore";
import { PIX_KEY_TYPES } from "@/lib/pix";
import type { PrintLayout, Profile } from "@/lib/domain";
import { LogoUploader } from "@/components/LogoUploader";
import {
  loadLocalSettings,
  saveLocalSettings,
  type LocalSettings,
} from "@/lib/local-store";
import {
  BUSINESS_BRANCHES,
  type BusinessBranch,
} from "@/lib/business-branches";
import {
  SHORTCUT_DEFINITIONS,
  AVAILABLE_SHORTCUT_KEYS,
  loadShortcutsConfig,
  saveShortcutsConfig,
  type ShortcutActionId,
} from "@/lib/keyboard-shortcuts";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Comprovante Pix" },
      {
        name: "description",
        content: "Cadastre sua chave Pix, dados da loja, logo, ramo e atalhos do teclado.",
      },
      { property: "og:title", content: "Configurações da loja | Comprovante Pix" },
      { property: "og:description", content: "Chave Pix, dados da loja, logo e atalhos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const [form, setForm] = useState<Partial<Profile>>({});
  const [localSettings, setLocalSettings] = useState<LocalSettings>(() => loadLocalSettings());
  const [shortcuts, setShortcuts] = useState<Record<ShortcutActionId, string>>(() =>
    loadShortcutsConfig(),
  );

  useEffect(() => {
    if (profile) {
      setForm(profile);
    }
  }, [profile]);

  function field<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleShortcutChange(actionId: ShortcutActionId, key: string) {
    const next = saveShortcutsConfig({ [actionId]: key });
    setShortcuts(loadShortcutsConfig());
    toast.success(`Atalho atualizado: ${actionId} → ${key}`);
  }

  function handleResetShortcuts() {
    const defaults: Record<ShortcutActionId, string> = {
      focus_barcode: "F1",
      open_free_item: "F2",
      open_weigh: "F3",
      checkout: "F4",
      clear_cart: "F8",
      open_shortcuts: "F9",
    };
    saveShortcutsConfig(defaults);
    setShortcuts(defaults);
    toast.success("Atalhos restaurados para o padrão.");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      // Salvar dados da loja na nuvem
      await update.mutateAsync({
        store_name: form.store_name?.trim() || "Minha loja",
        merchant_name: form.merchant_name?.trim() || "",
        city: form.city?.trim() || "SAO PAULO",
        phone: form.phone || null,
        document: form.document || null,
        pix_key: form.pix_key?.trim() || null,
        pix_key_type: form.pix_key_type ?? "aleatoria",
        print_layout: form.print_layout ?? "a4",
        receipt_footer: form.receipt_footer || null,
      });

      // Salvar logo e ramo nas configurações locais
      saveLocalSettings({
        store_name: form.store_name?.trim() || "Minha loja",
        store_logo_url: localSettings.store_logo_url,
        business_branch: localSettings.business_branch,
      });

      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  if (!profile) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-semibold">Configurações da Loja</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalize sua logo, dados bancários, nicho de atuação e atalhos do PDV.
        </p>
      </div>

      <form className="panel space-y-6 p-6" onSubmit={save}>
        {/* Seção 1: Identidade da Loja e Logo */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold border-b border-border pb-2">
            Identidade da Loja
          </h2>

          <div className="space-y-2">
            <Label htmlFor="loja">Nome da loja</Label>
            <Input
              id="loja"
              value={form.store_name ?? ""}
              onChange={(e) => field("store_name", e.target.value)}
            />
          </div>

          {/* Upload de Logo via arquivo */}
          <div className="space-y-2">
            <Label>Logo da Loja (arquivo de imagem)</Label>
            <LogoUploader
              value={localSettings.store_logo_url}
              onChange={(logoUrl) => {
                const next = saveLocalSettings({ store_logo_url: logoUrl });
                setLocalSettings(next);
              }}
            />
          </div>

          {/* Ramo do Negócio */}
          <div className="space-y-2">
            <Label>Ramo de Negócio / Layout padrão do PDV</Label>
            <Select
              value={localSettings.business_branch ?? "mercado"}
              onValueChange={(value) => {
                const next = saveLocalSettings({ business_branch: value as BusinessBranch });
                setLocalSettings(next);
                toast.info(`Ramo alterado para: ${BUSINESS_BRANCHES[value as BusinessBranch]?.label}`);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(BUSINESS_BRANCHES).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.icon} {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Define os recursos em destaque e atalhos do PDV adaptados ao seu segmento.
            </p>
          </div>
        </div>

        {/* Seção 2: Dados de Pagamento Pix */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold border-b border-border pb-2">
            Recebimento Pix
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recebedor">Nome de quem recebe</Label>
              <Input
                id="recebedor"
                value={form.merchant_name ?? ""}
                onChange={(e) => field("merchant_name", e.target.value)}
                placeholder="Como aparece no banco"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={form.city ?? ""}
                onChange={(e) => field("city", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tel">Telefone</Label>
              <Input
                id="tel"
                value={form.phone ?? ""}
                onChange={(e) => field("phone", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc">CPF / CNPJ (opcional)</Label>
              <Input
                id="doc"
                value={form.document ?? ""}
                onChange={(e) => field("document", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <div className="space-y-2">
              <Label htmlFor="pix">Chave Pix</Label>
              <Input
                id="pix"
                value={form.pix_key ?? ""}
                onChange={(e) => field("pix_key", e.target.value)}
                placeholder="Sua chave para receber"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo da chave</Label>
              <Select
                value={form.pix_key_type ?? "aleatoria"}
                onValueChange={(value) => field("pix_key_type", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIX_KEY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Seção 3: Impressão e Recibos */}
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold border-b border-border pb-2">
            Impressão e Comprovantes
          </h2>

          <div className="space-y-2">
            <Label>Layout de impressão preferido</Label>
            <Select
              value={form.print_layout ?? "a4"}
              onValueChange={(value) => field("print_layout", value as PrintLayout)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">Impressora normal (A4)</SelectItem>
                <SelectItem value="cupom">Impressora de cupom (80mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rodape">Mensagem no rodapé do comprovante</Label>
            <Textarea
              id="rodape"
              rows={2}
              value={form.receipt_footer ?? ""}
              onChange={(e) => field("receipt_footer", e.target.value)}
              placeholder="Obrigado pela preferência!"
            />
          </div>
        </div>

        {/* Seção 4: Configuração dos Atalhos de Teclado do PDV */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Keyboard className="size-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">
                Atalhos de Teclado do PDV
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetShortcuts}
              className="text-xs text-muted-foreground gap-1"
            >
              <RotateCcw className="size-3" /> Restaurar padrões
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Escolha qual tecla aciona cada função no caixa:
          </p>

          <div className="space-y-2.5">
            {SHORTCUT_DEFINITIONS.map((def) => {
              const currentKey = shortcuts[def.id] || def.defaultKey;
              return (
                <div
                  key={def.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{def.label}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {def.description}
                    </p>
                  </div>
                  <Select
                    value={currentKey}
                    onValueChange={(val) => handleShortcutChange(def.id, val)}
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
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Plano {profile.plan === "free" ? "grátis" : profile.plan} · limite de{" "}
            {profile.open_order_limit} pedidos em aberto
          </p>
          <Button type="submit" disabled={update.isPending}>
            Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
