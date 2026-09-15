import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product, Profile } from "@/lib/domain";
import {
  loadLocalProducts,
  loadLocalSettings,
  localProfile,
  saveLocalProducts,
  saveLocalSettings,
  type LocalSettings,
} from "@/lib/local-store";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/hooks/useStore";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `p${Date.now()}${Math.random().toString(16).slice(2)}`;
}

/** Produtos da conta quando logado, ou salvos no próprio aparelho quando visitante. */
export function useProducts() {
  const { user, loading } = useSession();
  const isGuest = !loading && !user;

  return useQuery({
    queryKey: ["products", user?.id ?? "local"],
    enabled: !loading,
    queryFn: async (): Promise<Product[]> => {
      if (isGuest) return loadLocalProducts();
      const { data, error } = await supabase
        .from("products")
        .select("id, name, barcode, price, unit, category, active")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, price: Number(row.price) })) as Product[];
    },
  });
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (product: Partial<Product> & { name: string }) => {
      if (!user) {
        const list = loadLocalProducts();
        const next: Product = {
          id: product.id ?? newId(),
          name: product.name,
          barcode: product.barcode ?? null,
          price: Number(product.price ?? 0),
          unit: product.unit ?? "un",
          category: product.category ?? null,
          active: product.active ?? true,
        };
        saveLocalProducts(
          list.some((p) => p.id === next.id)
            ? list.map((p) => (p.id === next.id ? next : p))
            : [...list, next],
        );
        return;
      }

      const values = {
        user_id: user.id,
        name: product.name,
        barcode: product.barcode?.trim() || null,
        price: Number(product.price ?? 0),
        unit: product.unit ?? "un",
        category: product.category?.trim() || null,
        active: product.active ?? true,
      };

      if (product.id) {
        const { error } = await supabase.from("products").update(values).eq("id", product.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("products").insert(values);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) {
        saveLocalProducts(loadLocalProducts().filter((p) => p.id !== id));
        return;
      }
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

/** Envia os produtos guardados no aparelho para a conta recém-criada. */
export function useImportLocalProducts() {
  const queryClient = useQueryClient();
  const { user } = useSession();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta primeiro.");
      const local = loadLocalProducts();
      if (!local.length) return 0;
      const { error } = await supabase.from("products").insert(
        local.map((p) => ({
          user_id: user.id,
          name: p.name,
          barcode: p.barcode || null,
          price: p.price,
          unit: p.unit,
          category: p.category,
          active: p.active,
        })),
      );
      if (error) throw error;
      saveLocalProducts([]);
      return local.length;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });
}

/** Perfil da loja: da conta quando logado, do aparelho quando visitante. */
export function useActiveProfile(): {
  profile: Profile | null;
  isGuest: boolean;
  loading: boolean;
  saveLocal: (values: Partial<LocalSettings>) => void;
  localSettings: LocalSettings;
} {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const remote = useProfile();
  const isGuest = !loading && !user;

  const localSettings = typeof window === "undefined" ? loadLocalSettings() : loadLocalSettings();

  return {
    profile: isGuest ? localProfile(localSettings) : (remote.data ?? null),
    isGuest,
    loading: loading || (!isGuest && remote.isLoading),
    localSettings,
    saveLocal: (values) => {
      saveLocalSettings(values);
      queryClient.invalidateQueries({ queryKey: ["local-settings"] });
    },
  };
}
