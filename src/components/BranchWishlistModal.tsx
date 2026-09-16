import { useState, useMemo } from "react";
import {
  Lightbulb,
  ThumbsUp,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Clock,
  Hammer,
  Send,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUSINESS_BRANCHES,
  loadFeatureWishes,
  loadUserVotes,
  submitNewWish,
  toggleWishVote,
  type BusinessBranch,
  type FeatureWish,
} from "@/lib/business-branches";

interface BranchWishlistModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBranch?: BusinessBranch;
}

export function BranchWishlistModal({
  open,
  onOpenChange,
  defaultBranch = "mercado",
}: BranchWishlistModalProps) {
  const [selectedTab, setSelectedTab] = useState<string>(defaultBranch);
  const [wishes, setWishes] = useState<FeatureWish[]>(() => loadFeatureWishes());
  const [votes, setVotes] = useState<Record<string, boolean>>(() => loadUserVotes());

  // Form de novo desejo
  const [showForm, setShowForm] = useState(false);
  const [newBranch, setNewBranch] = useState<BusinessBranch>(defaultBranch);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const filteredWishes = useMemo(() => {
    if (selectedTab === "todos") return wishes;
    return wishes.filter((w) => w.branch === selectedTab);
  }, [wishes, selectedTab]);

  function handleVote(wishId: string) {
    const { wishes: updated, voted } = toggleWishVote(wishId);
    setWishes(updated);
    setVotes(loadUserVotes());
    if (voted) {
      toast.success("Voto computado! Obrigado por nos ajudar a priorizar.");
    }
  }

  function handleCreateWish(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Por favor, dê um título para a sua ideia ou layout.");
      return;
    }
    const created = submitNewWish(newBranch, newTitle, newDesc);
    setWishes(loadFeatureWishes());
    setVotes(loadUserVotes());
    setSelectedTab(newBranch);
    setNewTitle("");
    setNewDesc("");
    setShowForm(false);
    toast.success("🎉 Desejo enviado com sucesso! Analisamos todos os pedidos dos lojistas.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/20 text-amber-400">
              <Lightbulb className="size-5" />
            </span>
            <div>
              <DialogTitle className="font-display text-xl font-bold tracking-tight">
                Desejar Layouts & Funções por Ramo
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Vote nas melhorias planejadas ou peça recursos sob medida para o seu segmento!
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Botão de Toggle para sugerir novo */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 pt-1">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedTab("todos")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedTab === "todos"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              Todos ({wishes.length})
            </button>
            {Object.values(BUSINESS_BRANCHES).map((branch) => {
              const count = wishes.filter((w) => w.branch === branch.id).length;
              const isActive = selectedTab === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => setSelectedTab(branch.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <span>{branch.icon}</span>
                  <span>{branch.label.split(" ")[0]}</span>
                  <span className="opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          <Button
            size="sm"
            variant={showForm ? "secondary" : "default"}
            className="text-xs"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              "Ver lista de desejos"
            ) : (
              <>
                <PlusCircle className="mr-1.5 size-3.5" />
                Pedir para meu ramo
              </>
            )}
          </Button>
        </div>

        {/* Formulário de Novo Desejo */}
        {showForm ? (
          <form
            onSubmit={handleCreateWish}
            className="panel space-y-4 border-amber-500/30 bg-amber-500/5 p-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <Sparkles className="size-4" />
              <span>O que você gostaria de ter no seu ramo de negócio?</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="branch-select">Qual o seu ramo?</Label>
                <Select
                  value={newBranch}
                  onValueChange={(val) => setNewBranch(val as BusinessBranch)}
                >
                  <SelectTrigger id="branch-select">
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wish-title">Nome do recurso ou layout</Label>
                <Input
                  id="wish-title"
                  placeholder="Ex: Leitor contínuo de balança Toledo"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wish-desc">Detalhes ou como funciona na sua rotina (opcional)</Label>
              <Textarea
                id="wish-desc"
                rows={3}
                placeholder="Ex: No meu mercado nós pesamos carnes e queijos na balança e sai etiqueta de código de barras começando com 2... seria ótimo o PDV ler direto!"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                <Send className="mr-1.5 size-3.5" />
                Enviar Desejo
              </Button>
            </div>
          </form>
        ) : null}

        {/* Lista de Desejos */}
        <div className="space-y-3 pt-1">
          {filteredWishes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Lightbulb className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-2 font-medium">Nenhum desejo registrado para este ramo ainda.</p>
              <p className="text-xs text-muted-foreground">
                Seja o primeiro a sugerir um layout ou recurso específico!
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-4 text-xs"
                onClick={() => {
                  setNewBranch((selectedTab as BusinessBranch) || "mercado");
                  setShowForm(true);
                }}
              >
                <PlusCircle className="mr-1.5 size-3.5" />
                Criar primeiro pedido
              </Button>
            </div>
          ) : (
            filteredWishes.map((wish) => {
              const branch = BUSINESS_BRANCHES[wish.branch];
              const hasVoted = !!votes[wish.id];

              return (
                <div
                  key={wish.id}
                  className={`panel flex flex-col gap-3 p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                    hasVoted ? "border-primary/50 bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{branch?.icon}</span>
                      <Badge variant="outline" className={`text-[11px] ${branch?.badgeColor}`}>
                        {branch?.label}
                      </Badge>

                      {wish.status === "em_desenvolvimento" ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                          <Hammer className="mr-1 size-3" /> Em desenvolvimento
                        </Badge>
                      ) : wish.status === "planejado" ? (
                        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-400 text-[10px]">
                          <CheckCircle2 className="mr-1 size-3" /> Planejado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]">
                          <Clock className="mr-1 size-3" /> Em análise
                        </Badge>
                      )}

                      {wish.userSubmitted ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Sugerido por cliente
                        </Badge>
                      ) : null}
                    </div>

                    <h4 className="font-semibold leading-snug">{wish.title}</h4>
                    {wish.description ? (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {wish.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:justify-center">
                    <Button
                      type="button"
                      size="sm"
                      variant={hasVoted ? "default" : "outline"}
                      onClick={() => handleVote(wish.id)}
                      className={`h-9 shrink-0 gap-1.5 text-xs font-semibold ${
                        hasVoted ? "bg-primary text-primary-foreground shadow-sm" : ""
                      }`}
                    >
                      <ThumbsUp className={`size-3.5 ${hasVoted ? "fill-current" : ""}`} />
                      <span>{hasVoted ? "Votado" : "Eu quero"}</span>
                      <span className="rounded-full bg-background/30 px-1.5 py-0.5 text-[10px]">
                        {wish.votes}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="rounded-xl bg-secondary/40 p-3 text-center text-xs text-muted-foreground">
          💡 Os recursos mais votados entram com prioridade nos próximos lançamentos do PDV e sistema Pix.
        </div>
      </DialogContent>
    </Dialog>
  );
}
