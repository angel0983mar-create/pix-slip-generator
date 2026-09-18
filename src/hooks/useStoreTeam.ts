import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StoreRole = "admin" | "pdv" | "estoque" | "completo";

export const ROLE_LABEL: Record<StoreRole, string> = {
  admin: "Administrador",
  pdv: "Caixa (PDV)",
  estoque: "Estoque / Produtos",
  completo: "Caixa + Estoque",
};

export interface StoreContext {
  userId: string;
  ownerId: string;
  role: StoreRole;
  isEmployee: boolean;
}

/** Em qual loja o usuário trabalha: a própria (admin) ou a do patrão (funcionário). */
export function useMyStore() {
  return useQuery({
    queryKey: ["my-store"],
    queryFn: async (): Promise<StoreContext | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;

      const { data, error } = await supabase.rpc("my_store");
      if (error) throw error;
      const row = (data as { owner_id: string; role: string }[] | null)?.[0];

      return {
        userId: uid,
        ownerId: row?.owner_id ?? uid,
        role: (row?.role as StoreRole) ?? "admin",
        isEmployee: Boolean(row),
      };
    },
  });
}

export interface StoreInvite {
  id: string;
  token: string;
  role: StoreRole;
  label: string | null;
  expires_at: string;
  revoked: boolean;
  uses: number;
  created_at: string;
}

export function useStoreInvites() {
  return useQuery({
    queryKey: ["store-invites"],
    queryFn: async (): Promise<StoreInvite[]> => {
      const { data, error } = await supabase
        .from("store_invites")
        .select("id, token, role, label, expires_at, revoked, uses, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StoreInvite[];
    },
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: { role: Exclude<StoreRole, "admin">; label?: string; days?: number }) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Entre na sua conta para criar links.");
      const expires = new Date(Date.now() + (values.days ?? 14) * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("store_invites")
        .insert({
          owner_id: uid,
          role: values.role,
          label: values.label?.trim() || null,
          expires_at: expires,
        })
        .select("id, token, role, label, expires_at, revoked, uses, created_at")
        .single();
      if (error) throw error;
      return data as unknown as StoreInvite;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-invites"] }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_invites").update({ revoked: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-invites"] }),
  });
}

export interface StoreMember {
  id: string;
  member_id: string;
  member_email: string | null;
  role: StoreRole;
  created_at: string;
}

export function useStoreMembers() {
  return useQuery({
    queryKey: ["store-members"],
    queryFn: async (): Promise<StoreMember[]> => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const { data, error } = await supabase
        .from("store_members")
        .select("id, member_id, member_email, role, created_at")
        .eq("owner_id", uid)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as StoreMember[];
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("store_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["store-members"] }),
  });
}

export function inviteUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/convite/${token}`;
}
