import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Keyboard,
  RotateCcw,
  Store,
  QrCode,
  Printer,
  Sparkles,
  Save,
} from "lucide-react";
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
import { BUSINESS_BRANCHES, type BusinessBranch } from "@/lib/business-branches";
import { LogoUploader } from "@/components/LogoUploader";
import {
  loadLocalSettings,
  saveLocalSettings,
  type LocalSettings,
} from "@/lib/local-store";
import {
  loadShortcutsConfig,
  saveShortcutsConfig,
  SHORTCUT_DEFINITIONS,
  AVAILABLE_SHORTCUT_KEYS,
  type ShortcutActionId,
} from "@/lib/keyboard-shortcuts";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da Loja | Comprovante Pix" },
      {
        name: "description",
        content: "Cadastre sua chave Pix, dados da loja, logo, ramo de atuação e atalhos do teclado.",
      },
      { property: "og:title", content: "Configurações da Loja | Comprovante Pix" },
      { property: "og:description", content: "Chave Pix, dados da loja, logo, ramo e atalhos." },
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
      setForm((prev) => ({
        ...prev,
        ...profile,
        business_branch: profile.business_branch || localSettings.business_branch || "mercado",
        store_logo_url: profile.store_logo_url || localSettings.store_logo_url || null,
      }));
    }
  }, [profile]);

  function field<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBranchChange(branch: BusinessBranch) {
    field("business_branch", branch);
    const updated = saveLocalSettings({ business_branch: branch });
    setLocalSettings(updated);
    toast.info(`Ramo selecionado: ${BUSINESS_BRANCHES[branch]?.label}`);
  }

  function handleLogoChange(logoUrl: string | null) {
    field("store_logo_url", logoUrl);
    const updated = saveLocalSettings({ store_logo_url: logoUrl });
    setLocalSettings(updated);
  }

  function handleShortcutChange(actionId: ShortcutActionId, key: string) {
    saveShortcutsConfig({ [actionId]: key });
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
    toast.success("Atalhos restaurados para os padrões.");
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const branch = (form.business_branch as BusinessBranch) || "mercado";
    const logo = form.store_logo_url || null;

    // Atualizar no storage local para manter sincronizado offline/online
    saveLocalSettings({
      store_name: form.store_name || "Minha loja",
      merchant_name: form.merchant_name || "",
      city: form.city || "SAO PAULO",
      phone: form.phone || null,
      document: form.document || null,
      pix_key: form.pix_key || null,
      pix_key_type: form.pix_key_type || "aleatoria",
      print_layout: form.print_layout || "a4",
      receipt_footer: form.receipt_footer || null,
      business_branch: branch,
      store_logo_url: logo,
    });

    try {
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
        business_branch: branch,
        store_logo_url: logo,
      });
      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar na nuvem.");
    }
  }

  if (!profile) return <p className="text-sm text-muted-foreground p-6">Carregando configurações…</p>;

  const currentBranch = (form.business_branch as BusinessBranch) || localSettings.business_branch || "mercado";
  const branchInfo = BUSINESS_BRANCHES[currentBranch] ?? BUSINESS_BRANCHES.mercado;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12 pt-2">
      {/* Header Minimalista */}
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Informações e Configurações</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Gerencie o ramo do negócio, dados da loja, recebimento Pix e atalhos de teclado do caixa.
        </p>
      </div>

      <form className="space-y-6" onSubmit={save}>
        {/* Seção 1: Ramo do Negócio & Dados da Loja */}
        <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Store className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide">Ramo de Atuação & Identidade da Loja</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ramo-select" className="text-xs font-medium">
                Ramo de Atuação / Segmento do PDV
              </Label>
              <Select
                value={currentBranch}
                onValueChange={(val) => handleBranchChange(val as BusinessBranch)}
              >
                <SelectTrigger id="ramo-select" className="h-10 text-xs">
                  <SelectValue placeholder="Selecione o ramo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(BUSINESS_BRANCHES).map((branch) => (
                    <SelectItem key={branch.id} value={branch.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{branch.icon}</span>
                        <span className="font-medium">{branch.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {branchInfo.tagline} — {branchInfo.description}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loja" className="text-xs font-medium">Nome da loja</Label>
                <Input
                  id="loja"
                  className="h-9 text-xs"
                  value={form.store_name ?? ""}
                  onChange={(e) => field("store_name", e.target.value)}
                  placeholder="Ex: Mercado Central"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cidade" className="text-xs font-medium">Cidade / UF</Label>
                <Input
                  id="cidade"
                  className="h-9 text-xs"
                  value={form.city ?? ""}
                  onChange={(e) => field("city", e.target.value)}
                  placeholder="Ex: São Paulo - SP"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tel" className="text-xs font-medium">Telefone / WhatsApp</Label>
                <Input
                  id="tel"
                  className="h-9 text-xs"
                  value={form.phone ?? ""}
                  onChange={(e) => field("phone", e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doc" className="text-xs font-medium">CPF ou CNPJ (opcional)</Label>
                <Input
                  id="doc"
                  className="h-9 text-xs"
                  value={form.document ?? ""}
                  onChange={(e) => field("document", e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-medium">Logo da Loja</Label>
              <LogoUploader
                value={form.store_logo_url ?? localSettings.store_logo_url}
                onChange={handleLogoChange}
              />
            </div>
          </div>
        </div>

        {/* Seção 2: Recebimento Pix */}
        <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <QrCode className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide">Recebimento Pix</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="recebedor" className="text-xs font-medium">Nome do titular (como cadastrado no banco)</Label>
              <Input
                id="recebedor"
                className="h-9 text-xs"
                value={form.merchant_name ?? ""}
                onChange={(e) => field("merchant_name", e.target.value)}
                placeholder="Nome completo do beneficiário"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <div className="space-y-1.5">
                <Label htmlFor="pix" className="text-xs font-medium">Chave Pix</Label>
                <Input
                  id="pix"
                  className="h-9 text-xs font-mono"
                  value={form.pix_key ?? ""}
                  onChange={(e) => field("pix_key", e.target.value)}
                  placeholder="Chave para gerar os QR Codes"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Tipo da chave</Label>
                <Select
                  value={form.pix_key_type ?? "aleatoria"}
                  onValueChange={(value) => field("pix_key_type", value)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIX_KEY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-xs">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 3: Impressão e Comprovantes */}
        <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Printer className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide">Impressão e Comprovantes</h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Formato de Impressão</Label>
              <Select
                value={form.print_layout ?? "a4"}
                onValueChange={(value) => field("print_layout", value as PrintLayout)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4" className="text-xs">Folha Normal (A4 / Carta)</SelectItem>
                  <SelectItem value="cupom" className="text-xs">Bobina Térmica / Cupom (80mm / 58mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rodape" className="text-xs font-medium">Mensagem no rodapé do comprovante</Label>
              <Textarea
                id="rodape"
                rows={2}
                className="text-xs resize-none"
                value={form.receipt_footer ?? ""}
                onChange={(e) => field("receipt_footer", e.target.value)}
                placeholder="Agradecemos a sua preferência! Volte sempre."
              />
            </div>
          </div>
        </div>

        {/* Seção 4: Atalhos de Teclado do PDV */}
        <div className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Keyboard className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-wide">Atalhos de Teclado do Caixa</h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetShortcuts}
              className="text-[11px] text-muted-foreground gap-1 h-7 px-2"
            >
              <RotateCcw className="size-3" /> Restaurar padrões
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Configure as teclas de atalho para operar o PDV rapidamente sem tirar a mão do teclado.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {SHORTCUT_DEFINITIONS.map((def) => {
              const currentKey = shortcuts[def.id] || def.defaultKey;
              return (
                <div
                  key={def.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/30 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-none">{def.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {def.description}
                    </p>
                  </div>
                  <Input
                    value={currentKey}
                    onChange={(e) => handleShortcutChange(def.id, e.target.value.toUpperCase().trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Tab") return;
                      e.preventDefault();
                      let keyName = e.key;
                      if (e.altKey && e.key !== "Alt") {
                        keyName = `Alt+${e.key.toUpperCase()}`;
                      } else if (e.ctrlKey && e.key !== "Control") {
                        keyName = `Ctrl+${e.key.toUpperCase()}`;
                      } else if (e.key.length === 1) {
                        keyName = e.key.toUpperCase();
                      }
                      handleShortcutChange(def.id, keyName);
                    }}
                    className="h-7 w-20 text-[11px] font-mono font-bold text-center bg-background border-border/80"
                    placeholder="Tecla"
                    title="Digite ou pressione a tecla desejada no teclado"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Barra de Ação Inferior */}
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            Plano {profile.plan === "free" ? "grátis" : profile.plan} · limite de{" "}
            {profile.open_order_limit} pedidos em aberto
          </p>
          <Button type="submit" disabled={update.isPending} className="gap-1.5">
            <Save className="size-4" />
            Salvar Configurações
          </Button>
        </div>
      </form>
    </div>
  );
}
