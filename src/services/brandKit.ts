import { supabase } from "@/integrations/supabase/client";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BrandKit, LogoPosition, SecondaryFont } from "../types";

function rowToKit(k: any): BrandKit {
  return {
    companyName: k.company_name || "",
    segment: k.segment,
    primaryColor: k.primary_color,
    secondaryColor: k.secondary_color,
    accentColor: k.accent_color,
    fontPair: k.font_pair,
    secondaryFont: (k.secondary_font as SecondaryFont) || undefined,
    brandVoice: k.brand_voice,
    logoHasName: k.logo_has_name,
    logoDataUrl: k.logo_url || undefined,
    mainActivity: k.main_activity || "",
    logoPosition: (k.logo_position as LogoPosition) || "bottom-right",
    assinatura: k.assinatura || "",
    uniformeDataUrl: k.uniforme_url || undefined,
    products: Array.isArray(k.products) ? k.products : [],
  };
}

// Server function: carrega Kit de Marca de qualquer usuário (admin bypass RLS).
export const loadKitServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    let targetId = data.userId;
    // Se não é o próprio caller, verifica se é admin
    if (targetId !== callerId) {
      const { data: isAdmin } = await supabaseAdmin.rpc(
        "has_role" as never,
        {
          _user_id: callerId,
          _role: "admin",
        } as never,
      );
      if (!isAdmin) targetId = callerId;
    }
    const { data: row } = await supabaseAdmin
      .from("brand_kits")
      .select("*")
      .eq("user_id", targetId)
      .maybeSingle();
    return row ? rowToKit(row) : null;
  });

const KitSchema = z.object({
  userId: z.string().uuid(),
  companyName: z.string().default(""),
  segment: z.string().default("SERVIÇOS"),
  primaryColor: z.string().default("#123a63"),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontPair: z.string().default("Montserrat"),
  secondaryFont: z.enum(["fina", "grossa"]).optional(),
  brandVoice: z.string().default(""),
  logoHasName: z.boolean().default(false),
  logoDataUrl: z.string().max(5_000_000).optional(),
  mainActivity: z.string().default(""),
  logoPosition: z.string().default("bottom-right"),
  assinatura: z.string().max(100).optional(),
  uniformeDataUrl: z.string().max(5_000_000).optional(),
  products: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
});

// Server function: salva Kit de Marca de qualquer usuário (admin bypass RLS).
export const saveKitServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => KitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    let targetId = data.userId;
    if (targetId !== callerId) {
      const { data: isAdmin } = await supabaseAdmin.rpc(
        "has_role" as never,
        {
          _user_id: callerId,
          _role: "admin",
        } as never,
      );
      if (!isAdmin) targetId = callerId;
    }

    const { data: existing } = await supabaseAdmin
      .from("brand_kits")
      .select("id")
      .eq("user_id", targetId)
      .maybeSingle();

    const row = {
      user_id: targetId,
      company_name: data.companyName,
      segment: data.segment,
      primary_color: data.primaryColor,
      secondary_color: data.secondaryColor,
      accent_color: data.accentColor,
      font_pair: data.fontPair,
      secondary_font: data.secondaryFont ?? null,
      brand_voice: data.brandVoice,
      logo_has_name: data.logoHasName,
      logo_url: data.logoDataUrl,
      main_activity: data.mainActivity,
      logo_position: data.logoPosition,
      assinatura: data.assinatura ?? null,
      uniforme_url: data.uniformeDataUrl ?? null,
      products: data.products,
      updated_at: new Date().toISOString(),
    };

    let savedRow: any;
    if (existing?.id) {
      const { data: d, error } = await supabaseAdmin
        .from("brand_kits")
        .update(row)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      savedRow = d;
    } else {
      const { data: d, error } = await supabaseAdmin
        .from("brand_kits")
        .insert(row)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      savedRow = d;
    }
    return rowToKit(savedRow);
  });

// Fallbacks legados (usados pelo próprio usuário — RLS ok para o caso normal)
export async function loadKitForUser(userId: string): Promise<BrandKit | null> {
  const { data } = await supabase
    .from("brand_kits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? rowToKit(data) : null;
}

export async function saveKitForUser(kit: BrandKit, userId: string): Promise<BrandKit> {
  const { data: existing, error: selErr } = await supabase
    .from("brand_kits")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  const row = {
    user_id: userId,
    company_name: kit.companyName,
    segment: kit.segment,
    primary_color: kit.primaryColor,
    secondary_color: kit.secondaryColor,
    accent_color: kit.accentColor,
    font_pair: kit.fontPair,
    secondary_font: kit.secondaryFont ?? null,
    brand_voice: kit.brandVoice,
    logo_has_name: kit.logoHasName ?? false,
    logo_url: kit.logoDataUrl,
    main_activity: kit.mainActivity,
    logo_position: kit.logoPosition || "bottom-right",
    assinatura: kit.assinatura ?? null,
    uniforme_url: kit.uniformeDataUrl ?? null,
    products: kit.products ?? [],
    updated_at: new Date().toISOString(),
  };

  let savedRow: any;
  if (existing?.id) {
    const { data, error } = await supabase
      .from("brand_kits")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    savedRow = data;
  } else {
    const { data, error } = await supabase.from("brand_kits").insert(row).select("*").single();
    if (error) throw new Error(error.message);
    savedRow = data;
  }
  return rowToKit(savedRow);
}
