import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Order, Profile } from "@/lib/domain";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Profile;

      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: uid })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created as unknown as Profile;
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<Profile>) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      const { error } = await supabase.from("profiles").update(values).eq("id", uid);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Order[];
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ["order", id],
    queryFn: async (): Promise<Order | null> => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as unknown as Order) ?? null;
    },
  });
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("LIMITE_PEDIDOS_ABERTOS")) {
    const match = message.match(/permite (\d+)/);
    return `Você chegou ao limite de ${match?.[1] ?? ""} pedidos em aberto do plano grátis. Marque um pedido como pago ou cancele para liberar espaço.`;
  }
  return message;
}
