import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar | Comprovante Pix" },
      {
        name: "description",
        content:
          "Entre com sua conta Google e comece a emitir cobranças Pix com QR Code e recibos de pagamento em PDF.",
      },
      { property: "og:title", content: "Entrar | Comprovante Pix" },
      {
        property: "og:description",
        content: "Acesse sua loja para gerar cobranças Pix e recibos de pagamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/pedidos", replace: true });
  }, [loading, session, navigate]);

  async function signInWithGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/pedidos", replace: true });
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    navigate({ to: "/pedidos", replace: true });
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: storeName },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Confira seu e-mail para confirmar a conta e depois entre.");
      return;
    }
    navigate({ to: "/pedidos", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>

        <div className="panel p-7">
          <h1 className="font-display text-2xl font-semibold">Acesse sua conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus pedidos e recibos ficam salvos e disponíveis em qualquer aparelho.
          </p>

          <Button
            className="mt-6 w-full"
            size="lg"
            variant="secondary"
            disabled={busy}
            onClick={signInWithGoogle}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Continuar com Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> ou com e-mail{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="entrar">
            <TabsList className="w-full">
              <TabsTrigger className="flex-1" value="entrar">
                Entrar
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="criar">
                Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entrar">
              <form className="space-y-4 pt-4" onSubmit={signIn}>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={busy}>
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="criar">
              <form className="space-y-4 pt-4" onSubmit={signUp}>
                <div className="space-y-2">
                  <Label htmlFor="loja">Nome da sua loja</Label>
                  <Input
                    id="loja"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex.: Lanchonete da Ana"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-novo">E-mail</Label>
                  <Input
                    id="email-novo"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senha-nova">Senha</Label>
                  <Input
                    id="senha-nova"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" size="lg" type="submit" disabled={busy}>
                  Criar minha conta grátis
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
