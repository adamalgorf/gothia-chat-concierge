import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BedDouble,
  Brush,
  Check,
  ClipboardList,
  Coffee,
  Minus,
  RotateCcw,
  Sparkles,
  UserPlus2,
  UtensilsCrossed,
} from "lucide-react";
import { listTickets, STAFF_MEMBERS, updateTicket, type Ticket } from "@/lib/tickets.functions";
import { listActiveGuests } from "@/lib/guests.functions";

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

const TYPE_META: Record<string, { label: string; icon: typeof Brush; tint: string; bg: string }> = {
  WORK_REQUEST: { label: "Städ & service", icon: Brush, tint: "text-sky-300", bg: "bg-sky-400/10" },
  DEBITERA_MINIBAR: { label: "Minibar", icon: Coffee, tint: "text-amber-300", bg: "bg-amber-400/10" },
  HOTEL_SERVICE: { label: "Service", icon: UtensilsCrossed, tint: "text-emerald-300", bg: "bg-emerald-400/10" },
};

function typeMeta(t: string) {
  return TYPE_META[t] ?? { label: t, icon: ClipboardList, tint: "text-foreground/70", bg: "bg-foreground/10" };
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Ny",
  in_progress: "Pågår",
  done: "Klar",
  kitchen_received: "Köket",
  confirmed_booking: "Bokad",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  in_progress: "bg-sky-400",
  done: "bg-emerald-400",
  kitchen_received: "bg-rose-400",
  confirmed_booking: "bg-violet-400",
};

function isOpen(t: Ticket) {
  return t.status !== "done";
}

type Priority = "high" | "normal" | "low";

const PRIORITY_META: Record<
  Priority,
  { label: string; rank: number; icon: typeof AlertTriangle; chip: string; stripe: string; sort: number }
> = {
  high: {
    label: "Hög prio",
    rank: 0,
    icon: AlertTriangle,
    chip: "border-rose-400/40 bg-rose-400/10 text-rose-200",
    stripe: "bg-rose-400",
    sort: 0,
  },
  normal: {
    label: "Normal",
    rank: 1,
    icon: ArrowUp,
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    stripe: "bg-amber-400",
    sort: 1,
  },
  low: {
    label: "Låg",
    rank: 2,
    icon: Minus,
    chip: "border-foreground/20 bg-foreground/5 text-foreground/60",
    stripe: "bg-foreground/40",
    sort: 2,
  },
};

const URGENT_KEYWORDS = [
  "akut", "läck", "leck", "trasig", "trasigt", "sönder", "sonder", "stopp",
  "översvämn", "oversvamn", "lukt", "rök", "rok", "brand", "blod", "skadad",
  "allergi", "läkare", "lakare", "ambulans", "fastnat", "kallt", "ingen värme",
  "ingen el", "elavbrott",
];

const HIGH_PRIORITY_TYPES = new Set<string>([]);
const LOW_PRIORITY_TYPES = new Set<string>(["DEBITERA_MINIBAR"]);

function getPriority(t: Ticket): Priority {
  const text = `${t.details ?? ""}`.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) return "high";
  if (HIGH_PRIORITY_TYPES.has(t.transaction_type)) return "high";
  if (LOW_PRIORITY_TYPES.has(t.transaction_type)) return "low";
  if (t.transaction_type === "HOTEL_SERVICE") return "normal";
  if (t.transaction_type === "WORK_REQUEST") return "low";
  return "normal";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "nyss";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

function InternalPortal() {
  const fetchTickets = useServerFn(listTickets);
  const fetchGuests = useServerFn(listActiveGuests);
  const patchTicket = useServerFn(updateTicket);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("open");

  const ticketsQuery = useQuery({
    queryKey: ["internal-tickets"],
    queryFn: () => fetchTickets(),
    refetchInterval: 5000,
  });

  const guestsQuery = useQuery({
    queryKey: ["internal-guests"],
    queryFn: () => fetchGuests(),
    refetchInterval: 15000,
  });

  const guestsByRoom = useMemo(() => {
    const map = new Map<string, { name: string; email: string; phone: string }>();
    for (const g of guestsQuery.data ?? []) {
      map.set(g.room_number, { name: g.full_name, email: g.email, phone: g.phone });
    }
    return map;
  }, [guestsQuery.data]);

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status?: string; assigned_to?: string | null }) =>
      patchTicket({ data: vars as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-tickets"] }),
  });

  const all = ticketsQuery.data ?? [];
  const openCount = all.filter(isOpen).length;
  const doneCount = all.filter((t) => t.status === "done").length;
  const unassignedCount = all.filter((t) => isOpen(t) && !t.assigned_to).length;

  const filtered = useMemo(() => {
    const list =
      filter === "open" ? all.filter(isOpen) : filter === "done" ? all.filter((t) => t.status === "done") : all;
    return [...list].sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
      const pa = PRIORITY_META[getPriority(a)].sort;
      const pb = PRIORITY_META[getPriority(b)].sort;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [all, filter]);

  return (
    <div className="min-h-dvh bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-foreground/15 text-foreground/70 transition-colors hover:border-gold/50 hover:text-gold"
              aria-label="Tillbaka till gästvyn"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <div className="flex flex-col">
              <span className="font-display text-base font-medium tracking-wide text-foreground sm:text-lg">
                GOTHIA <span className="italic text-gold">Internal</span>
              </span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.35em] text-foreground/50">
                Operations
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/70">Live</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {/* Title */}
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">Förfrågningar</p>
          <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl">
            Ärenden från <span className="italic text-gold">gästrummen</span>
          </h1>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Öppna" value={openCount} accent="text-amber-300" />
          <StatCard label="Otilldelade" value={unassignedCount} accent="text-sky-300" />
          <StatCard label="Klara" value={doneCount} accent="text-emerald-300" />
        </div>

        {/* Filter tabs */}
        <div className="mt-8 inline-flex w-full max-w-md gap-1 rounded-full border border-foreground/15 bg-foreground/5 p-1">
          {(
            [
              { key: "open", label: "Öppna", count: openCount },
              { key: "all", label: "Alla", count: all.length },
              { key: "done", label: "Klara", count: doneCount },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
                filter === f.key
                  ? "bg-gold text-gold-foreground shadow-sm"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {f.label}
              <span className={`ml-1.5 text-[10px] ${filter === f.key ? "opacity-80" : "opacity-50"}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-6 space-y-2.5">
          {ticketsQuery.isLoading && (
            <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/50">
              Laddar ärenden...
            </div>
          )}

          {!ticketsQuery.isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.03] p-12 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-gold/70" strokeWidth={1.5} />
              <p className="mt-3 font-display text-lg text-foreground/80">Allt under kontroll</p>
              <p className="mt-1 text-xs text-foreground/50">Inga ärenden i denna vy just nu.</p>
            </div>
          )}

          {filtered.map((t) => {
            const meta = typeMeta(t.transaction_type);
            const Icon = meta.icon;
            const isDone = t.status === "done";
            const pending = mutation.isPending && mutation.variables?.id === t.id;
            const priority = getPriority(t);
            const prio = PRIORITY_META[priority];
            const PrioIcon = prio.icon;
            return (
              <article
                key={t.id}
                className={`group relative overflow-hidden rounded-2xl border transition-all ${
                  isDone
                    ? "border-foreground/10 bg-foreground/[0.02] opacity-70"
                    : priority === "high"
                      ? "border-rose-400/30 bg-rose-400/[0.04] hover:border-rose-400/50 hover:bg-rose-400/[0.07]"
                      : "border-foreground/10 bg-foreground/[0.04] hover:border-gold/30 hover:bg-foreground/[0.06]"
                }`}
              >
                {/* Priority stripe */}
                <span
                  className={`absolute left-0 top-0 h-full w-1 ${isDone ? "bg-foreground/20" : prio.stripe}`}
                  aria-hidden
                />

                <div className="flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:pl-6">
                  {/* Icon + main */}
                  <div className="flex flex-1 items-start gap-4 min-w-0">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.tint}`}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center gap-1.5 font-display text-base font-medium text-foreground">
                          <BedDouble className="h-3.5 w-3.5 text-foreground/50" strokeWidth={2} />
                          Rum {t.room_number}
                        </span>
                        <span className="text-foreground/30">·</span>
                        <span className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/60">
                          {meta.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${prio.chip} ${
                            priority === "high" && !isDone ? "animate-pulse" : ""
                          }`}
                          title={prio.label}
                        >
                          <PrioIcon className="h-3 w-3" strokeWidth={2.5} />
                          {prio.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/70`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status] ?? "bg-foreground/40"}`} />
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                      </div>


                      <p className="mt-2 text-sm leading-relaxed text-foreground/85 sm:text-[15px]">{t.details}</p>

                      {guestsByRoom.get(t.room_number) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/55">
                          <span className="font-medium text-foreground/80">
                            {guestsByRoom.get(t.room_number)!.name}
                          </span>
                          <a
                            href={`mailto:${guestsByRoom.get(t.room_number)!.email}`}
                            className="hover:text-gold"
                          >
                            {guestsByRoom.get(t.room_number)!.email}
                          </a>
                          <a
                            href={`tel:${guestsByRoom.get(t.room_number)!.phone}`}
                            className="hover:text-gold"
                          >
                            {guestsByRoom.get(t.room_number)!.phone}
                          </a>
                        </div>
                      )}

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/50">
                        <span>{timeAgo(t.created_at)} sedan</span>
                        {t.assigned_to ? (
                          <span className="inline-flex items-center gap-1 text-gold/90">
                            <UserPlus2 className="h-3 w-3" strokeWidth={2} />
                            {t.assigned_to}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-foreground/40">
                            <UserPlus2 className="h-3 w-3" strokeWidth={2} />
                            Ej tilldelad
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-2">
                    <select
                      value={t.assigned_to ?? ""}
                      onChange={(e) =>
                        mutation.mutate({
                          id: t.id,
                          assigned_to: e.target.value === "" ? null : e.target.value,
                        })
                      }
                      disabled={mutation.isPending}
                      className="min-w-[7.5rem] flex-1 rounded-full border border-foreground/15 bg-background/60 px-3 py-2 text-xs font-medium text-foreground/80 outline-none transition-colors focus:border-gold disabled:opacity-50 sm:flex-none"
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
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-foreground/20 bg-foreground/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                        Återöppna
                      </button>
                    ) : (
                      <button
                        onClick={() => mutation.mutate({ id: t.id, status: "done" })}
                        disabled={mutation.isPending}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-gold-foreground transition-all hover:bg-gold-bright active:scale-[0.97] disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        {pending ? "Sparar..." : "Klar"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 sm:p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/50">{label}</p>
      <p className={`mt-2 font-display text-3xl font-light tracking-tight sm:text-4xl ${accent}`}>{value}</p>
    </div>
  );
}
