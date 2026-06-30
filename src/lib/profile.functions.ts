import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchProfileData } from "@/repository/profile.repo";

export const loadProfileServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ targetUserId: z.string().uuid().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    const targetId = data.targetUserId || callerId;
    return fetchProfileData(callerId, targetId);
  });
