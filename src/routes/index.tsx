import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  FileText,
  ImageDown,
  Printer,
  QrCode,
  Send,
  Wallet,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Comprovante Pix — cobranças com QR Code e recibos em PDF" },
      {
        name: "description",
        content:
          "Gere cobranças Pix com QR Code, marque como pago e emita recibo em PDF ou imagem. Impressão A4 ou cupom 80mm. Plano grátis com login pelo Google.",
      },
      { property: "og:title", content: "Comprovante Pix — cobranças e recibos em segundos" },
      {
        property: "og:description",
        content:
          "QR Code Pix, recibo de pagamento em PDF e imagem, impressão em cupom 80mm e modo caixa. Comece grátis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: QrCode,
    title: "QR Code Pix na hora",
    text: "Informe o valor e o sistema monta o QR Code e o Pix Copia e Cola com a sua chave.",
  },
  {
    icon: BadgeCheck,
    title: "Recibo de pago",
    text: "Confirmou o Pix no seu banco? Marque como pago e o recibo com quitação sai pronto.",
  },
  {
    icon: FileText,
    title: "PDF do jeito certo",
    text: "Salve em PDF pela própria impressão, com layout limpo e valores conferidos.",
  },
  {
    icon: Printer,
    title: "A4 ou cupom 80mm",
    text: "Escolha entre folha comum ou impressora de cupom não fiscal antes de imprimir.",
  },
  {
    icon: ImageDown,
    title: "Comprovante em imagem",
    text: "Baixe o comprovante como imagem para mandar no WhatsApp em um toque.",
  },
  {
    icon: Send,
    title: "Envio da fatura",
    text: "Mensagem pronta com valor, vencimento e o código Pix para colar no app do banco.",
  },
  {
    icon: Wallet,
    title: "Modo caixa",
    text: "Veja o total recebido no dia, por forma de pagamento, e o que ainda está em aberto.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
            C
          </span>
          <span className="font-display text-lg font-semibold">Comprovante Pix</span>
        </div>
        <Button asChild variant="secondary">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 md:pt-16">
        <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          Plano grátis · sem cartão
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold md:text-6xl">
          Cobre no Pix e entregue o <span className="text-gradient-brand">comprovante</span> na
          hora.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Crie o pedido, mostre o QR Code, confirme o pagamento e imprima o recibo em PDF, imagem ou
          na impressora de cupom. Tudo em um só lugar, sem mensalidade para começar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Começar grátis com Google</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="panel p-6">
              <Icon className="size-6 text-primary" />
              <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <h2 className="font-display text-3xl font-semibold">Planos</h2>
        <p className="mt-2 text-muted-foreground">
          Comece de graça. O limite vale só para pedidos ainda em aberto — pedidos pagos nunca
          contam.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="panel p-7">
            <h3 className="font-display text-xl font-semibold">Grátis</h3>
            <p className="mt-1 text-3xl font-semibold">R$ 0</p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {[
                "Até 15 pedidos em aberto ao mesmo tempo",
                "QR Code Pix e Copia e Cola ilimitados",
                "Recibo em PDF, imagem e cupom 80mm",
                "Modo caixa do dia",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth">Criar conta grátis</Link>
            </Button>
          </div>

          <div className="panel border-primary/40 p-7">
            <h3 className="font-display text-xl font-semibold">Mensal</h3>
            <p className="mt-1 text-3xl font-semibold">
              R$ 19,90<span className="text-base text-muted-foreground">/mês</span>
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {[
                "Pedidos em aberto sem limite",
                "Histórico completo e busca",
                "Rodapé e dados da loja personalizados",
                "Prioridade no suporte",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {item}
                </li>
              ))}
            </ul>
            <Button variant="secondary" className="mt-6 w-full" disabled>
              Em breve
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Comprovante Pix · gere cobranças e recibos sem complicação.
      </footer>
    </div>
  );
}
