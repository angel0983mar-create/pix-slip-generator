import { useState } from "react";
import { toast } from "sonner";
import { Copy, Link2, Trash2, Users, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import {
  ROLE_LABEL,
  inviteUrl,
  useCreateInvite,
  useRemoveMember,
  useRevokeInvite,
  useStoreInvites,
  useStoreMembers,
  type StoreRole,
} from "@/hooks/useStoreTeam";

type InviteRole = Exclude<StoreRole, "admin">;

export function TeamPanel() {
  const [role, setRole] = useState<InviteRole>("pdv");
  const [label, setLabel] = useState("");
  const invites = useStoreInvites();
  const members = useStoreMembers();
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const remove = useRemoveMember();

  async function copy(token: string) {
    await navigator.clipboard.writeText(inviteUrl(token));
    toast.success("Link copiado! Envie para o funcionário.");
  }

  async function handleCreate() {
    try {
      const invite = await create.mutateAsync({ role, label });
      setLabel("");
      await copy(invite.token);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o link.");
    }
  }

  const activeInvites = (invites.data ?? []).filter(
    (i) => !i.revoked && new Date(i.expires_at) > new Date(),
  );

  return (
    <section className="panel space-y-4 rounded-xl border border-border p-5">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold">Equipe / Modo funcionário</h2>
          <p className="text-xs text-muted-foreground">
            Crie um link para alguém cuidar do caixa e/ou do estoque. O funcionário entra com a conta Google
            dele e não vê caixa do dia nem configurações.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
        <Select value={role} onValueChange={(v) => setRole(v as InviteRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdv">{ROLE_LABEL.pdv}</SelectItem>
            <SelectItem value="estoque">{ROLE_LABEL.estoque}</SelectItem>
            <SelectItem value="completo">{ROLE_LABEL.completo}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Nome do funcionário (opcional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Button type="button" onClick={handleCreate} disabled={create.isPending} className="gap-1.5">
          <Link2 className="size-4" /> Gerar link
        </Button>
      </div>

      {activeInvites.length ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Links ativos (valem 14 dias)</p>
          {activeInvites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
              <Badge variant="secondary">{ROLE_LABEL[i.role]}</Badge>
              <span className="flex-1 truncate">{i.label || "Sem nome"}</span>
              <span className="text-[11px] text-muted-foreground">
                até {formatDate(i.expires_at)} · {i.uses} uso(s)
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => copy(i.token)}>
                <Copy className="size-3.5" />
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Acesse o caixa da loja: ${inviteUrl(i.token)}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Enviar pelo WhatsApp"
                >
                  <MessageCircle className="size-3.5" />
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => revoke.mutate(i.id)}
                aria-label="Cancelar link"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Funcionários com acesso</p>
        {members.data?.length ? (
          members.data.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-sm">
              <Badge>{ROLE_LABEL[m.role]}</Badge>
              <span className="flex-1 truncate">{m.member_email ?? "Funcionário"}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm("Remover o acesso deste funcionário?")) remove.mutate(m.id);
                }}
              >
                <Trash2 className="size-3.5" /> Remover
              </Button>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum funcionário ainda.</p>
        )}
      </div>
    </section>
  );
}
