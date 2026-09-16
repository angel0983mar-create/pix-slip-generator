export type BusinessBranch = "mercado" | "restaurante" | "moda" | "servicos" | "geral";

export interface BranchConfig {
  id: BusinessBranch;
  label: string;
  icon: string;
  tagline: string;
  badgeColor: string;
  description: string;
  quickCategories: { id: string; label: string; icon: string }[];
  features: string[];
}

export const BUSINESS_BRANCHES: Record<BusinessBranch, BranchConfig> = {
  mercado: {
    id: "mercado",
    label: "Supermercado & Mercearia",
    icon: "🛒",
    tagline: "Pesagem, código de barras contínuo e categorias de alimentos",
    badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    description:
      "Focado em passagem rápida de itens por código de barras, atalho de balança para pesagem por quilo/grama e organização de hortifrúti, bebidas e frios.",
    quickCategories: [
      { id: "hortifruti", label: "Hortifrúti / FLV", icon: "🍎" },
      { id: "bebidas", label: "Bebidas", icon: "🥤" },
      { id: "acougue", label: "Açougue & Carnes", icon: "🥩" },
      { id: "padaria", label: "Padaria & Frios", icon: "🥖" },
      { id: "mercearia", label: "Mercearia", icon: "🥫" },
      { id: "limpeza", label: "Limpeza & Higiene", icon: "🧼" },
    ],
    features: [
      "Leitor de código de barras em destaque",
      "Calculadora rápida de pesagem (kg/g)",
      "Grade de produtos com fotos/ícones grandes",
      "Filtro visual por corredor/categoria de mercado",
    ],
  },
  restaurante: {
    id: "restaurante",
    label: "Restaurante & Lanchonete",
    icon: "🍔",
    tagline: "Comandas, mesas, adicionais e observações no prato",
    badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    description:
      "Ideal para bares, lanchonetes, marmitarias e delivery. Inclui identificação de mesa/comanda e notas de preparo nos pedidos.",
    quickCategories: [
      { id: "lanches", label: "Lanches & Burgers", icon: "🍔" },
      { id: "porcoes", label: "Porções", icon: "🍟" },
      { id: "bebidas", label: "Bebidas & Sucos", icon: "🍹" },
      { id: "refeicoes", label: "Pratos & Marmitas", icon: "🍽️" },
      { id: "sobremesas", label: "Sobremesas", icon: "🍰" },
    ],
    features: [
      "Identificação de Mesa ou Número de Comanda",
      "Observações por item (ex: sem cebola, ponto da carne)",
      "Atalho para bebidas e adicionais rápidos",
      "Impressão pronta para cozinha ou balcão",
    ],
  },
  moda: {
    id: "moda",
    label: "Moda & Vestuário",
    icon: "👗",
    tagline: "Tamanhos, cores, peças e desconto rápido no balcão",
    badgeColor: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    description:
      "Ideal para lojas de roupas, calçados e acessórios. Destaque para desconto percentual rápido e referência de peças.",
    quickCategories: [
      { id: "feminino", label: "Feminino", icon: "👗" },
      { id: "masculino", label: "Masculino", icon: "👔" },
      { id: "calcados", label: "Calçados", icon: "👟" },
      { id: "acessorios", label: "Acessórios", icon: "👜" },
      { id: "promocoes", label: "Promoções / Sale", icon: "🏷️" },
    ],
    features: [
      "Botões rápidos de desconto balcão (5%, 10%, 15%, 20%)",
      "Controle ágil de número de peças vendidas",
      "Visual limpo para apresentação ao cliente no balcão",
    ],
  },
  servicos: {
    id: "servicos",
    label: "Serviços & Oficinas",
    icon: "🔧",
    tagline: "Ordem de serviço, técnico/atendente e descrição do serviço",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    description:
      "Para oficinas, barbearias, assistências técnicas e prestadores autônomos. Facilita o registro de mão de obra e peças aplicadas.",
    quickCategories: [
      { id: "manutencao", label: "Mão de Obra / Reparo", icon: "🔧" },
      { id: "pecas", label: "Peças & Componentes", icon: "⚙️" },
      { id: "revisao", label: "Revisão / Diagnóstico", icon: "📋" },
      { id: "avulso", label: "Serviço Avulso", icon: "💼" },
    ],
    features: [
      "Identificação do Técnico / Prestador do serviço",
      "Campo de laudo / descrição detalhada do serviço",
      "Itens de mão de obra + materiais consumidos",
    ],
  },
  geral: {
    id: "geral",
    label: "Caixa Rápido (Geral)",
    icon: "⚡",
    tagline: "Fluxo ágil e compacto para qualquer comércio ou balcão",
    badgeColor: "bg-primary/15 text-primary border-primary/30",
    description:
      "Layout minimalista e universal otimizado para agilidade máxima em qualquer tipo de negócio.",
    quickCategories: [
      { id: "geral", label: "Geral", icon: "📦" },
      { id: "destaques", label: "Mais Vendidos", icon: "⭐" },
    ],
    features: [
      "Fluxo universal rápido",
      "Entrada facilitada de itens sem cadastro",
      "QR Code Pix instantâneo",
    ],
  },
};

export interface FeatureWish {
  id: string;
  branch: BusinessBranch;
  title: string;
  description: string;
  votes: number;
  status: "planejado" | "em_analise" | "em_desenvolvimento";
  userSubmitted?: boolean;
}

export const INITIAL_FEATURE_WISHES: FeatureWish[] = [
  {
    id: "balanca-toledo",
    branch: "mercado",
    title: "Leitura direta de etiquetas de balança (Toledo / Filizola)",
    description:
      "Interpretação automática de código de barras 2xxxx que traz preço ou peso embutido na etiqueta do açougue/padaria.",
    votes: 42,
    status: "em_desenvolvimento",
  },
  {
    id: "pesagem-tela",
    branch: "mercado",
    title: "Calculadora de Hortifrúti por Kg na hora da venda",
    description:
      "Ao tocar na maçã ou banana, abrir teclado numérico para digitar as gramas ou peso e calcular o valor exato.",
    votes: 38,
    status: "planejado",
  },
  {
    id: "comanda-cozinha",
    branch: "restaurante",
    title: "Impressão de comanda dividida para a cozinha / bar",
    description:
      "Separar bebidas para o balcão e lanches/porções para a cozinha na hora de enviar o pedido.",
    votes: 56,
    status: "em_desenvolvimento",
  },
  {
    id: "mesa-tempo",
    branch: "restaurante",
    title: "Controle de tempo de mesa e taxa de serviço (10%)",
    description: "Opção rápida para incluir os 10% do garçom e visualizar mesas ocupadas.",
    votes: 29,
    status: "planejado",
  },
  {
    id: "grade-tamanho-cor",
    branch: "moda",
    title: "Grade simplificada de Tamanho (P/M/G) e Cor",
    description:
      "Poder selecionar o tamanho da peça direto no PDV sem precisar cadastrar um produto totalmente novo.",
    votes: 34,
    status: "em_analise",
  },
  {
    id: "desconto-combo",
    branch: "moda",
    title: "Leve 3 Pague 2 / Desconto Progressivo",
    description:
      "Regras automáticas de desconto por quantidade de peças no carrinho de roupas e calçados.",
    votes: 23,
    status: "planejado",
  },
  {
    id: "os-status",
    branch: "servicos",
    title: "Envio de status da Ordem de Serviço via WhatsApp",
    description:
      "Botão para avisar o cliente no WhatsApp: 'Seu aparelho / veículo está pronto para retirada!'.",
    votes: 47,
    status: "em_desenvolvimento",
  },
  {
    id: "fiado-caderneta",
    branch: "geral",
    title: "Controle de 'Caderneta' / Conta do Cliente (Fiado)",
    description:
      "Registrar compras pendentes no nome de clientes frequentes com extrato acumulado.",
    votes: 61,
    status: "em_analise",
  },
];

const WISHES_STORAGE_KEY = "cpx.feature_wishes.v1";
const VOTES_STORAGE_KEY = "cpx.user_votes.v1";

export function loadFeatureWishes(): FeatureWish[] {
  if (typeof window === "undefined") return INITIAL_FEATURE_WISHES;
  try {
    const raw = window.localStorage.getItem(WISHES_STORAGE_KEY);
    if (!raw) return INITIAL_FEATURE_WISHES;
    const custom: FeatureWish[] = JSON.parse(raw);
    const customIds = new Set(custom.map((c) => c.id));
    const merged = [
      ...custom,
      ...INITIAL_FEATURE_WISHES.filter((item) => !customIds.has(item.id)),
    ];
    return merged;
  } catch {
    return INITIAL_FEATURE_WISHES;
  }
}

export function saveFeatureWishes(wishes: FeatureWish[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WISHES_STORAGE_KEY, JSON.stringify(wishes));
}

export function loadUserVotes(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VOTES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function toggleWishVote(
  wishId: string,
): { wishes: FeatureWish[]; voted: boolean } {
  const currentVotes = loadUserVotes();
  const alreadyVoted = !!currentVotes[wishId];
  const allWishes = loadFeatureWishes();

  const updatedWishes = allWishes.map((w) => {
    if (w.id === wishId) {
      return {
        ...w,
        votes: alreadyVoted ? Math.max(0, w.votes - 1) : w.votes + 1,
      };
    }
    return w;
  });

  saveFeatureWishes(updatedWishes);

  if (alreadyVoted) {
    delete currentVotes[wishId];
  } else {
    currentVotes[wishId] = true;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(currentVotes));
  }

  return { wishes: updatedWishes, voted: !alreadyVoted };
}

export function submitNewWish(
  branch: BusinessBranch,
  title: string,
  description: string,
): FeatureWish {
  const allWishes = loadFeatureWishes();
  const newWish: FeatureWish = {
    id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    branch,
    title: title.trim(),
    description: description.trim(),
    votes: 1,
    status: "em_analise",
    userSubmitted: true,
  };

  const updated = [newWish, ...allWishes];
  saveFeatureWishes(updated);

  const votes = loadUserVotes();
  votes[newWish.id] = true;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
  }

  return newWish;
}
