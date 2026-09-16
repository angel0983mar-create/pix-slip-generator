import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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


export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações da loja | Comprovante Pix" },
      {
        name: "description",
        content: "Cadastre sua chave Pix, dados da loja e o layout de impressão preferido.",
      },
      { property: "og:title", content: "Configurações da loja | Comprovante Pix" },
      { property: "og:description", content: "Chave Pix, dados da loja e layout de impressão." },
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

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  function field<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
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
        business_branch: form.business_branch ?? "mercado",
        store_logo_url: form.store_logo_url || null,
      });

      toast.success("Dados salvos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    }
  }

  if (!profile) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esses dados aparecem no QR Code e nos comprovantes.
        </p>
      </div>

      <form className="panel space-y-5 p-6" onSubmit={save}>
        <div className="space-y-2">
          <Label>Ramo do negócio</Label>
          <Select
            value={form.business_branch ?? "mercado"}
            onValueChange={(value) => field("business_branch", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(BUSINESS_BRANCHES).map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.icon} {branch.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {BUSINESS_BRANCHES[(form.business_branch as BusinessBranch) ?? "mercado"]?.tagline}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="logo">Link do logo da loja (opcional)</Label>
          <Input
            id="logo"
            placeholder="https://exemplo.com/logo.png"
            value={form.store_logo_url ?? ""}
            onChange={(e) => field("store_logo_url", e.target.value || null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="loja">Nome da loja</Label>
          <Input
            id="loja"
            value={form.store_name ?? ""}
            onChange={(e) => field("store_name", e.target.value)}
          />
        </div>


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

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Plano {profile.plan === "free" ? "grátis" : profile.plan} · limite de{" "}
            {profile.open_order_limit} pedidos em aberto
          </p>
          <Button type="submit" disabled={update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </div>
  );
}
