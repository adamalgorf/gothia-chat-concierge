import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BedDouble, Brush, CheckCircle2, ClipboardList, Coffee, Sparkles, UserPlus2, UtensilsCrossed } from "lucide-react";
import { listTickets, STAFF_MEMBERS, updateTicket, type Ticket } from "@/lib/tickets.functions";

export const Route = createFileRoute("/internal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Internal Portal · Gothia Towers" },
      { name: "description", content: "Personalvy för att hantera gästförfrågningar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InternalPortal,
});

type Filter = "open" | "all" | "done";

const TYPE_META: Record<string, { label: string; icon: typeof Brush; tint: string }> = {
  WORK_REQUEST: { label: "Städ & service", icon: Brush, tint: "text-sky-300" },
  DEBITERA_MINIBAR: { label: "Minibar", icon: Coffee, tint: "text-amber-300" },
  HOTEL_SERVICE: { label: "Service & bokning", icon: UtensilsCrossed, tint: "text-emerald-300" },
};

function typeMeta(t: string) {
  return TYPE_META[t] ?? { label: t, icon: ClipboardList, tint: "text-foreground/70" };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Ny",
  in_progress: "Pågår",
  done: "Klar",
  kitchen_received: "Köket",
  confirmed_booking: "Bokad",
};

const STATUS_TINT: Record<string, string> = {
  pending: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  in_progress: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  done: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  kitchen_received: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  confirmed_booking: "border-violet-400/40 bg-violet-400/10 text-violet-200",
};

function isOpen(t: Ticket) {
  return t.status !== "done";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nyss";
  if (m < 60) return `${m} min sedan`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h sedan`;
  const d = Math.floor(h / 24);
  return `${d} d sedan`;
}

function InternalPortal() {
  const fetchTickets = useServerFn(listTickets);
  const patchTicket = useServerFn(updateTicket);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const ticketsQuery = useQuery({
    queryKey: ["internal-tickets"],
    queryFn: () => fetchTickets(),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status?: string; assigned_to?: string | null }) =>
      patchTicket({ data: vars as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-tickets"] }),
  });

  const all = ticketsQuery.data ?? [];
  const filtered = useMemo(() => {
    if (filter === "open") return all.filter(isOpen);
    if (filter === "done") return all.filter((t) => t.status === "done");
    return all;
  }, [all, filter]);

  const openCount = all.filter(isOpen).length;
  const doneCount = all.filter((t) => t.status === "done").length;

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-foreground/60 hover:text-gold"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              Gästvy
            </Link>
            <div className="hidden h-6 w-px bg-border/60 sm:block" />
            <div className="flex flex-col">
              <span className="font-display text-base font-medium tracking-wide text-foreground sm:text-lg">
                GOTHIA <span className="italic text-gold">Internal</span>
              </span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/50">
                Operations · Samfex
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5 backdrop-blur-md">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-gold" />
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/70">
                Live
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">
              Förfrågningar
            </p>
            <h1 className="mt-3 font-display text-4xl font-light leading-tight tracking-tight text-foreground sm:text-5xl">
              Aktiva ärenden från <span className="italic text-gold">gästrummen</span>.
            </h1>
          </div>

          <div className="flex gap-2 rounded-full border border-foreground/15 bg-foreground/5 p-1 backdrop-blur-md">
            {(
              [
                { key: "open", label: `Öppna · ${openCount}` },
                { key: "all", label: `Alla · ${all.length}` },
                { key: "done", label: `Klara · ${doneCount}` },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] transition-all ${
                  filter === f.key
                    ? "bg-gold text-gold-foreground"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 space-y-3">
          {ticketsQuery.isLoading && (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/50">
              Laddar ärenden...
            </div>
          )}

          {!ticketsQuery.isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-10 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-gold/70" strokeWidth={1.5} />
              <p className="mt-3 font-display text-lg text-foreground/80">Inga öppna ärenden</p>
              <p className="mt-1 text-xs text-foreground/50">Allt är under kontroll just nu.</p>
            </div>
          )}

          {filtered.map((t) => {
            const meta = typeMeta(t.transaction_type);
            const Icon = meta.icon;
            const isDone = t.status === "done";
            return (
              <div
                key={t.id}
                className={`group rounded-2xl border bg-foreground/5 p-5 backdrop-blur-md transition-all hover:bg-foreground/10 ${
                  isDone ? "border-foreground/10 opacity-60" : "border-foreground/15 hover:border-gold/40"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-foreground/15 bg-background/40 ${meta.tint}`}>
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-background/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/70">
                          <BedDouble className="h-3 w-3" strokeWidth={2} />
                          Rum {t.room_number}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/50">
                          {meta.label}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] ${
                            STATUS_TINT[t.status] ?? "border-foreground/20 bg-foreground/5 text-foreground/60"
                          }`}
                        >
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>
                      <p className="mt-2.5 text-[15px] leading-relaxed text-foreground/90">
                        {t.details}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.25em] text-foreground/45">
                        <span>{timeAgo(t.created_at)}</span>
                        {t.assigned_to ? (
                          <span className="inline-flex items-center gap-1 text-gold/80">
                            <UserPlus2 className="h-3 w-3" strokeWidth={2} />
                            {t.assigned_to}
                          </span>
                        ) : (
                          <span className="text-foreground/40">Ej tilldelad</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={t.assigned_to ?? ""}
                      onChange={(e) =>
                        mutation.mutate({
                          id: t.id,
                          assigned_to: e.target.value === "" ? null : e.target.value,
                        })
                      }
                      disabled={mutation.isPending}
                      className="rounded-full border border-foreground/20 bg-background/40 px-3 py-1.5 text-[11px] font-medium tracking-wide text-foreground/80 outline-none focus:border-gold disabled:opacity-50"
                    >
                      <option value="">Tilldela...</option>
                      {STAFF_MEMBERS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    {isDone ? (
                      <button
                        onClick={() => mutation.mutate({ id: t.id, status: "pending" })}
                        disabled={mutation.isPending}
                        className="rounded-full border border-foreground/20 bg-foreground/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                      >
                        Återöppna
                      </button>
                    ) : (
                      <button
                        onClick={() => mutation.mutate({ id: t.id, status: "done" })}
                        disabled={mutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.97] disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                        Markera klar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
