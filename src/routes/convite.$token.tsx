import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { ROLE_LABEL, type StoreRole } from "@/hooks/useStoreTeam";

export const Route = createFileRoute("/convite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite de funcionário | Comprovante Pix" },
      { name: "description", content: "Entre na equipe da loja para operar o caixa ou o estoque." },
      { property: "og:title", content: "Convite para a equipe da loja" },
      { property: "og:description", content: "Aceite o convite e opere o PDV ou o estoque da loja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

const PENDING_KEY = "cpx.pending_invite";

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading } = useSession();
  const [info, setInfo] = useState<{ store_name: string; role: StoreRole; valid: boolean } | null>(null);
  const [checked, setChecked] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    supabase.rpc("store_invite_info", { _token: token }).then(({ data }) => {
      const row = (data as { store_name: string; role: StoreRole; valid: boolean }[] | null)?.[0];
      setInfo(row ?? null);
      setChecked(true);
    });
  }, [token]);

  async function accept() {
    setJoining(true);
    const { data, error } = await supabase.rpc("accept_store_invite", { _token: token });
    setJoining(false);
    if (error) {
      const msg = error.message.includes("CONVITE_PROPRIO")
        ? "Este link é da sua própria loja."
        : error.message.includes("CONVITE_INVALIDO")
          ? "Link expirado ou cancelado. Peça um novo ao administrador."
          : "Não foi possível aceitar o convite.";
      toast.error(msg);
      return;
    }
    window.localStorage.removeItem(PENDING_KEY);
    await queryClient.invalidateQueries();
    const role = (data as { role: StoreRole }[] | null)?.[0]?.role;
    toast.success("Você entrou na equipe da loja!");
    navigate({ to: role === "estoque" ? "/produtos" : "/pdv" });
  }

  // Volta do login do Google: aceita automaticamente
  useEffect(() => {
    if (user && info?.valid && window.localStorage.getItem(PENDING_KEY) === token) void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, info]);

  async function signIn() {
    window.localStorage.setItem(PENDING_KEY, token);
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/convite/${token}`,
    });
    if (res.error) toast.error("Não foi possível entrar com o Google.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="panel w-full max-w-md space-y-5 rounded-2xl border border-border p-6 text-center">
        {!checked || loading ? (
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
        ) : !info || !info.valid ? (
          <>
            <h1 className="font-display text-xl font-bold">Convite inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este link expirou ou foi cancelado. Peça um novo link ao administrador da loja.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
              <UserPlus className="size-6" />
            </span>
            <div className="space-y-1">
              <h1 className="font-display text-xl font-bold">{info.store_name}</h1>
              <p className="text-sm text-muted-foreground">
                Você foi convidado como <strong className="text-foreground">{ROLE_LABEL[info.role]}</strong>.
              </p>
            </div>
            {user ? (
              <Button className="w-full" onClick={accept} disabled={joining}>
                {joining ? <Loader2 className="size-4 animate-spin" /> : null} Entrar na equipe
              </Button>
            ) : (
              <Button className="w-full" onClick={signIn}>
                Entrar com Google para aceitar
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
