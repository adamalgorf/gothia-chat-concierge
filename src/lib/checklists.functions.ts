import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ChecklistTemplate = {
  id: string;
  title: string;
  role: string;
  items: string[];
};

export type ChecklistCompletion = {
  template_id: string;
  item_index: number;
  checked_by: string | null;
  checked_at: string;
};

export const listChecklists = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ templates: ChecklistTemplate[]; completions: ChecklistCompletion[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const [tpl, comp] = await Promise.all([
      supabaseAdmin.from("checklist_templates").select("id, title, role, items").order("title"),
      supabaseAdmin
        .from("checklist_completions")
        .select("template_id, item_index, checked_by, checked_at")
        .eq("day", today),
    ]);
    if (tpl.error) throw new Error(tpl.error.message);
    if (comp.error) throw new Error(comp.error.message);
    const templates = (tpl.data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      role: t.role,
      items: Array.isArray(t.items) ? (t.items as string[]) : [],
    }));
    return { templates, completions: (comp.data ?? []) as ChecklistCompletion[] };
  },
);

const ToggleSchema = z.object({
  template_id: z.string().uuid(),
  item_index: z.number().int().min(0).max(100),
  checked: z.boolean(),
  checked_by: z.string().min(1).max(50).optional(),
});

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ToggleSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    if (data.checked) {
      const { error } = await supabaseAdmin.from("checklist_completions").upsert(
        {
          template_id: data.template_id,
          day: today,
          item_index: data.item_index,
          checked_by: data.checked_by ?? null,
        },
        { onConflict: "template_id,day,item_index" },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("checklist_completions")
        .delete()
        .eq("template_id", data.template_id)
        .eq("day", today)
        .eq("item_index", data.item_index);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
