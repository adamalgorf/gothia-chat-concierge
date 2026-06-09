import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  BedDouble,
  Brush,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Coffee,
  LayoutGrid,
  Minus,
  RotateCcw,
  Sparkles,
  Ticket as TicketIcon,
  UserPlus2,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { listTickets, STAFF_MEMBERS, updateTicket, type Ticket } from "@/lib/tickets.functions";
import { listActiveGuests } from "@/lib/guests.functions";
import { listRooms, ROOM_STATUSES, updateRoom, type Room, type RoomStatus } from "@/lib/rooms.functions";
import { listChecklists, toggleChecklistItem } from "@/lib/checklists.functions";

export const Route = createFileRoute("/internal")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Internal Portal · Gothia Towers" },
      { name: "description", content: "Personalvy för att hantera drift, städning och gästförfrågningar." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InternalPortal,
});

type Section = "overview" | "tickets" | "housekeeping" | "minibar" | "checklists" | "stats";

const NAV: { key: Section; label: string; icon: typeof LayoutGrid }[] = [
  { key: "overview", label: "Översikt", icon: LayoutGrid },
  { key: "tickets", label: "Ärenden", icon: TicketIcon },
  { key: "housekeeping", label: "Städning", icon: Brush },
  { key: "minibar", label: "Minibar", icon: Coffee },
  { key: "checklists", label: "Checklistor", icon: CheckSquare },
  { key: "stats", label: "Statistik", icon: BarChart3 },
];

/* =====================================================================
 * Shared meta
 * ===================================================================== */

const TYPE_META: Record<string, { label: string; icon: typeof Brush; tint: string; bg: string }> = {
  WORK_REQUEST: { label: "Städ & service", icon: Brush, tint: "text-sky-300", bg: "bg-sky-400/10" },
  DEBITERA_MINIBAR: { label: "Minibar", icon: Coffee, tint: "text-amber-300", bg: "bg-amber-400/10" },
  HOTEL_SERVICE: { label: "Service", icon: UtensilsCrossed, tint: "text-emerald-300", bg: "bg-emerald-400/10" },
};
const typeMeta = (t: string) =>
  TYPE_META[t] ?? { label: t, icon: ClipboardList, tint: "text-foreground/70", bg: "bg-foreground/10" };

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

const isOpen = (t: Ticket) => t.status !== "done";

type Priority = "high" | "normal" | "low";
const PRIORITY_META: Record<
  Priority,
  { label: string; icon: typeof AlertTriangle; chip: string; stripe: string; sort: number }
> = {
  high: { label: "Hög prioritet", icon: AlertTriangle, chip: "border-rose-400/40 bg-rose-400/10 text-rose-200", stripe: "bg-rose-400", sort: 0 },
  normal: { label: "Normal prioritet", icon: ArrowUp, chip: "border-amber-400/30 bg-amber-400/10 text-amber-200", stripe: "bg-amber-400", sort: 1 },
  low: { label: "Låg prioritet", icon: Minus, chip: "border-foreground/20 bg-foreground/5 text-foreground/60", stripe: "bg-foreground/40", sort: 2 },
};

const URGENT_KEYWORDS = [
  "akut","läck","leck","trasig","trasigt","sönder","sonder","stopp","översvämn","oversvamn",
  "lukt","rök","rok","brand","blod","skadad","allergi","läkare","lakare","ambulans","fastnat",
  "kallt","ingen värme","ingen el","elavbrott",
];

function getPriority(t: Ticket): Priority {
  const text = `${t.details ?? ""}`.toLowerCase();
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) return "high";
  if (t.transaction_type === "DEBITERA_MINIBAR") return "low";
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
  return `${Math.floor(h / 24)} d`;
}

/* =====================================================================
 * Room status meta
 * ===================================================================== */

const ROOM_META: Record<RoomStatus, { label: string; tint: string; ring: string; dot: string }> = {
  vacant_clean: { label: "Klart", tint: "bg-emerald-400/10 text-emerald-200", ring: "border-emerald-400/30", dot: "bg-emerald-400" },
  vacant_dirty: { label: "Smutsigt", tint: "bg-rose-400/10 text-rose-200", ring: "border-rose-400/30", dot: "bg-rose-400" },
  cleaning: { label: "Städas", tint: "bg-sky-400/10 text-sky-200", ring: "border-sky-400/30", dot: "bg-sky-400" },
  inspected: { label: "Inspekterat", tint: "bg-violet-400/10 text-violet-200", ring: "border-violet-400/30", dot: "bg-violet-400" },
  occupied: { label: "Belagt", tint: "bg-foreground/10 text-foreground/80", ring: "border-foreground/20", dot: "bg-foreground/60" },
  out_of_order: { label: "Ur funktion", tint: "bg-amber-400/10 text-amber-200", ring: "border-amber-400/40", dot: "bg-amber-400" },
};

/* =====================================================================
 * Root component
 * ===================================================================== */

function InternalPortal() {
  const [section, setSection] = useState<Section>("overview");

  const fetchTickets = useServerFn(listTickets);
  const fetchGuests = useServerFn(listActiveGuests);
  const fetchRooms = useServerFn(listRooms);
  const fetchChecklists = useServerFn(listChecklists);

  const ticketsQ = useQuery({ queryKey: ["internal-tickets"], queryFn: () => fetchTickets(), refetchInterval: 5000 });
  const guestsQ = useQuery({ queryKey: ["internal-guests"], queryFn: () => fetchGuests(), refetchInterval: 15000 });
  const roomsQ = useQuery({ queryKey: ["internal-rooms"], queryFn: () => fetchRooms(), refetchInterval: 10000 });
  const checklistsQ = useQuery({ queryKey: ["internal-checklists"], queryFn: () => fetchChecklists(), refetchInterval: 15000 });

  const tickets = ticketsQ.data ?? [];
  const rooms = roomsQ.data ?? [];

  const guestsByRoom = useMemo(() => {
    const map = new Map<string, { name: string; email: string; phone: string }>();
    for (const g of guestsQ.data ?? []) map.set(g.room_number, { name: g.full_name, email: g.email, phone: g.phone });
    return map;
  }, [guestsQ.data]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
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

        {/* Section nav */}
        <div className="border-t border-border/40">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 sm:px-6">
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = section === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() => setSection(n.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all ${
                    active
                      ? "bg-gold text-gold-foreground shadow-sm"
                      : "text-foreground/55 hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        {section === "overview" && (
          <OverviewSection
            tickets={tickets}
            rooms={rooms}
            guestsCount={guestsQ.data?.length ?? 0}
            onJump={setSection}
          />
        )}
        {section === "tickets" && <TicketsSection tickets={tickets} loading={ticketsQ.isLoading} guestsByRoom={guestsByRoom} />}
        {section === "housekeeping" && <HousekeepingSection rooms={rooms} loading={roomsQ.isLoading} />}
        {section === "minibar" && <MinibarSection tickets={tickets} guestsByRoom={guestsByRoom} />}
        {section === "checklists" && <ChecklistsSection data={checklistsQ.data} loading={checklistsQ.isLoading} />}
        {section === "stats" && <StatsSection tickets={tickets} rooms={rooms} />}
      </main>
    </div>
  );
}

/* =====================================================================
 * Overview
 * ===================================================================== */

function OverviewSection({
  tickets,
  rooms,
  guestsCount,
  onJump,
}: {
  tickets: Ticket[];
  rooms: Room[];
  guestsCount: number;
  onJump: (s: Section) => void;
}) {
  const openTickets = tickets.filter(isOpen).length;
  const highPrio = tickets.filter((t) => isOpen(t) && getPriority(t) === "high").length;
  const minibarOpen = tickets.filter((t) => isOpen(t) && t.transaction_type === "DEBITERA_MINIBAR").length;
  const toClean = rooms.filter((r) => r.status === "vacant_dirty").length;
  const inProgressClean = rooms.filter((r) => r.status === "cleaning").length;
  const ready = rooms.filter((r) => r.status === "vacant_clean" || r.status === "inspected").length;

  return (
    <div>
      <SectionHeader kicker="Översikt" title={<>Driftcentral <span className="italic text-gold">just nu</span></>} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Aktiva gäster" value={guestsCount} accent="text-foreground" icon={BedDouble} />
        <KpiCard label="Öppna ärenden" value={openTickets} accent="text-amber-300" icon={TicketIcon} onClick={() => onJump("tickets")} />
        <KpiCard label="Hög prioritet" value={highPrio} accent="text-rose-300" icon={AlertTriangle} onClick={() => onJump("tickets")} />
        <KpiCard label="Rum att städa" value={toClean} accent="text-sky-300" icon={Brush} onClick={() => onJump("housekeeping")} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SummaryTile
          title="Städning"
          onClick={() => onJump("housekeeping")}
          rows={[
            { label: "Smutsiga", value: toClean, tone: "rose" },
            { label: "Pågår", value: inProgressClean, tone: "sky" },
            { label: "Klara", value: ready, tone: "emerald" },
          ]}
        />
        <SummaryTile
          title="Minibar"
          onClick={() => onJump("minibar")}
          rows={[
            { label: "Att debitera", value: minibarOpen, tone: "amber" },
            { label: "Debiterade idag", value: tickets.filter((t) => t.transaction_type === "DEBITERA_MINIBAR" && t.status === "done" && sameDay(t.updated_at)).length, tone: "emerald" },
          ]}
        />
        <SummaryTile
          title="Work Requests"
          onClick={() => onJump("tickets")}
          rows={[
            { label: "Öppna", value: tickets.filter((t) => isOpen(t) && t.transaction_type === "WORK_REQUEST").length, tone: "sky" },
            { label: "Otilldelade", value: tickets.filter((t) => isOpen(t) && !t.assigned_to).length, tone: "amber" },
            { label: "Klara idag", value: tickets.filter((t) => t.status === "done" && sameDay(t.updated_at)).length, tone: "emerald" },
          ]}
        />
      </div>

      {/* Recent activity */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-light text-foreground/90">Senaste aktivitet</h2>
        <div className="mt-3 divide-y divide-foreground/10 rounded-2xl border border-foreground/10 bg-foreground/[0.03]">
          {tickets.slice(0, 6).map((t) => {
            const meta = typeMeta(t.transaction_type);
            const Icon = meta.icon;
            return (
              <div key={t.id} className="flex items-center gap-4 p-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.bg} ${meta.tint}`}>
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground/85">
                    Rum {t.room_number} · {meta.label}
                  </p>
                  <p className="truncate text-xs text-foreground/50">{t.details}</p>
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-[0.2em] text-foreground/40">{timeAgo(t.created_at)}</span>
              </div>
            );
          })}
          {tickets.length === 0 && (
            <div className="p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/40">Inget ännu</div>
          )}
        </div>
      </div>
    </div>
  );
}

function sameDay(iso: string) {
  const a = new Date(iso);
  const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function KpiCard({
  label,
  value,
  accent,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  accent: string;
  icon: typeof BedDouble;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`group rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-4 text-left transition-all sm:p-5 ${
        onClick ? "hover:border-gold/30 hover:bg-foreground/[0.06]" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-foreground/50">{label}</p>
        <Icon className="h-4 w-4 text-foreground/40 transition-colors group-hover:text-gold" strokeWidth={1.75} />
      </div>
      <p className={`mt-2 font-display text-3xl font-light tracking-tight sm:text-4xl ${accent}`}>{value}</p>
    </Comp>
  );
}

function SummaryTile({
  title,
  rows,
  onClick,
}: {
  title: string;
  rows: { label: string; value: number; tone: "rose" | "sky" | "emerald" | "amber" }[];
  onClick: () => void;
}) {
  const toneMap = {
    rose: "text-rose-300", sky: "text-sky-300", emerald: "text-emerald-300", amber: "text-amber-300",
  };
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5 text-left transition-all hover:border-gold/30 hover:bg-foreground/[0.06]"
    >
      <p className="font-display text-base font-medium text-foreground/90">{title}</p>
      <div className="mt-4 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.18em] text-foreground/55">{r.label}</span>
            <span className={`font-display text-2xl font-light ${toneMap[r.tone]}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

/* =====================================================================
 * Tickets
 * ===================================================================== */

type Filter = "open" | "all" | "done";

function TicketsSection({
  tickets,
  loading,
  guestsByRoom,
  initialFilter,
  typeFilter,
}: {
  tickets: Ticket[];
  loading: boolean;
  guestsByRoom: Map<string, { name: string; email: string; phone: string }>;
  initialFilter?: Filter;
  typeFilter?: string;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "open");
  const patchTicket = useServerFn(updateTicket);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (vars: { id: string; status?: string; assigned_to?: string | null }) =>
      patchTicket({ data: vars as never }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["internal-tickets"] }),
  });

  const scoped = typeFilter ? tickets.filter((t) => t.transaction_type === typeFilter) : tickets;
  const openCount = scoped.filter(isOpen).length;
  const doneCount = scoped.filter((t) => t.status === "done").length;
  const unassignedCount = scoped.filter((t) => isOpen(t) && !t.assigned_to).length;

  const filtered = useMemo(() => {
    const list =
      filter === "open" ? scoped.filter(isOpen) : filter === "done" ? scoped.filter((t) => t.status === "done") : scoped;
    return [...list].sort((a, b) => {
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;
      const pa = PRIORITY_META[getPriority(a)].sort;
      const pb = PRIORITY_META[getPriority(b)].sort;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [scoped, filter]);

  return (
    <div>
      {!typeFilter && (
        <SectionHeader
          kicker="Förfrågningar"
          title={<>Ärenden från <span className="italic text-gold">gästrummen</span></>}
        />
      )}

      <div className={`grid grid-cols-3 gap-3 sm:gap-4 ${typeFilter ? "" : "mt-6"}`}>
        <StatCard label="Öppna" value={openCount} accent="text-amber-300" />
        <StatCard label="Otilldelade" value={unassignedCount} accent="text-sky-300" />
        <StatCard label="Klara" value={doneCount} accent="text-emerald-300" />
      </div>

      <div className="mt-8 inline-flex w-full max-w-md gap-1 rounded-full border border-foreground/15 bg-foreground/5 p-1">
        {([
          { key: "open", label: "Öppna", count: openCount },
          { key: "all", label: "Alla", count: scoped.length },
          { key: "done", label: "Klara", count: doneCount },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all ${
              filter === f.key ? "bg-gold text-gold-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-[10px] ${filter === f.key ? "opacity-80" : "opacity-50"}`}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-2.5">
        {loading && (
          <div className="rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/50">
            Laddar ärenden...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.03] p-12 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-gold/70" strokeWidth={1.5} />
            <p className="mt-3 font-display text-lg text-foreground/80">Allt under kontroll</p>
            <p className="mt-1 text-xs text-foreground/50">Inga ärenden i denna vy just nu.</p>
          </div>
        )}

        {filtered.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            guest={guestsByRoom.get(t.room_number)}
            pending={mutation.isPending && mutation.variables?.id === t.id}
            onAssign={(v) => mutation.mutate({ id: t.id, assigned_to: v })}
            onToggleDone={(done) => mutation.mutate({ id: t.id, status: done ? "done" : "pending" })}
          />
        ))}
      </div>
    </div>
  );
}

function TicketCard({
  ticket: t,
  guest,
  pending,
  onAssign,
  onToggleDone,
}: {
  ticket: Ticket;
  guest?: { name: string; email: string; phone: string };
  pending: boolean;
  onAssign: (v: string | null) => void;
  onToggleDone: (done: boolean) => void;
}) {
  const meta = typeMeta(t.transaction_type);
  const Icon = meta.icon;
  const isDone = t.status === "done";
  const priority = getPriority(t);
  const prio = PRIORITY_META[priority];
  const PrioIcon = prio.icon;
  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border transition-all ${
        isDone
          ? "border-foreground/10 bg-foreground/[0.02] opacity-70"
          : priority === "high"
            ? "border-rose-400/30 bg-rose-400/[0.04] hover:border-rose-400/50 hover:bg-rose-400/[0.07]"
            : "border-foreground/10 bg-foreground/[0.04] hover:border-gold/30 hover:bg-foreground/[0.06]"
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${isDone ? "bg-foreground/20" : prio.stripe}`} aria-hidden />
      <div className="flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:pl-6">
        <div className="flex flex-1 items-start gap-4 min-w-0">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.tint}`}>
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-display text-base font-medium text-foreground">
                <BedDouble className="h-3.5 w-3.5 text-foreground/50" strokeWidth={2} />
                Rum {t.room_number}
              </span>
              <span className="text-foreground/30">·</span>
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/60">{meta.label}</span>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-0.5 text-[11px] font-semibold ${prio.chip} ${
                  priority === "high" && !isDone ? "animate-pulse" : ""
                }`}
                title={prio.label}
              >
                <PrioIcon className="h-3 w-3" strokeWidth={2.5} />
                {prio.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-foreground/5 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/70">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[t.status] ?? "bg-foreground/40"}`} />
                {STATUS_LABEL[t.status] ?? t.status}
              </span>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-foreground/85 sm:text-[15px]">{t.details}</p>

            {guest && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground/55">
                <span className="font-medium text-foreground/80">{guest.name}</span>
                <a href={`mailto:${guest.email}`} className="hover:text-gold">{guest.email}</a>
                <a href={`tel:${guest.phone}`} className="hover:text-gold">{guest.phone}</a>
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

        <div className="flex items-center gap-2 sm:flex-col sm:items-stretch sm:gap-2">
          <select
            value={t.assigned_to ?? ""}
            onChange={(e) => onAssign(e.target.value === "" ? null : e.target.value)}
            disabled={pending}
            className="w-[6.75rem] rounded-full border border-foreground/15 bg-background/60 px-2.5 py-2 pr-3 text-xs font-medium text-foreground/80 outline-none transition-colors focus:border-gold disabled:opacity-50"
          >
            <option value="">Tilldela personal</option>
            {STAFF_MEMBERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {isDone ? (
            <button
              onClick={() => onToggleDone(false)}
              disabled={pending}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-foreground/20 bg-foreground/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-all hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
              Återöppna
            </button>
          ) : (
            <button
              onClick={() => onToggleDone(true)}
              disabled={pending}
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
}

/* =====================================================================
 * Housekeeping (rooms board)
 * ===================================================================== */

function HousekeepingSection({ rooms, loading }: { rooms: Room[]; loading: boolean }) {
  const patch = useServerFn(updateRoom);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (vars: { room_number: string; status?: RoomStatus; assigned_cleaner?: string | null }) =>
      patch({ data: vars as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal-rooms"] }),
  });

  const [floor, setFloor] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<RoomStatus | "all">("all");

  const floors = useMemo(() => Array.from(new Set(rooms.map((r) => r.floor).filter((f): f is number => f != null))).sort(), [rooms]);

  const filtered = rooms.filter(
    (r) => (floor === "all" || r.floor === floor) && (statusFilter === "all" || r.status === statusFilter),
  );

  const counts = ROOM_STATUSES.map((s) => ({ s, n: rooms.filter((r) => r.status === s).length }));

  return (
    <div>
      <SectionHeader
        kicker="Housekeeping"
        title={<>Allokering & <span className="italic text-gold">klarrapportering</span></>}
      />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {counts.map(({ s, n }) => {
          const m = ROOM_META[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-xl border p-3 text-left transition-all ${
                statusFilter === s ? "border-gold/50 bg-foreground/[0.06]" : `${m.ring} bg-foreground/[0.03] hover:bg-foreground/[0.05]`
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                <span className="text-[10px] uppercase tracking-[0.18em] text-foreground/60">{m.label}</span>
              </div>
              <p className="mt-1 font-display text-2xl font-light text-foreground">{n}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">Våning</span>
        <button
          onClick={() => setFloor("all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${floor === "all" ? "bg-gold text-gold-foreground" : "border border-foreground/15 text-foreground/70 hover:text-foreground"}`}
        >
          Alla
        </button>
        {floors.map((f) => (
          <button
            key={f}
            onClick={() => setFloor(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${floor === f ? "bg-gold text-gold-foreground" : "border border-foreground/15 text-foreground/70 hover:text-foreground"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/50">
          Laddar rum...
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((r) => {
          const m = ROOM_META[r.status];
          return (
            <div key={r.room_number} className={`rounded-2xl border ${m.ring} bg-foreground/[0.03] p-4`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-2xl font-light text-foreground">{r.room_number}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">Våning {r.floor ?? "-"}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${m.tint}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                  {m.label}
                </span>
              </div>

              <select
                value={r.status}
                onChange={(e) => mutation.mutate({ room_number: r.room_number, status: e.target.value as RoomStatus })}
                className="mt-3 w-full rounded-lg border border-foreground/15 bg-background/60 px-2.5 py-1.5 text-xs text-foreground/80 outline-none focus:border-gold"
              >
                {ROOM_STATUSES.map((s) => (
                  <option key={s} value={s}>{ROOM_META[s].label}</option>
                ))}
              </select>

              <select
                value={r.assigned_cleaner ?? ""}
                onChange={(e) => mutation.mutate({ room_number: r.room_number, assigned_cleaner: e.target.value || null })}
                className="mt-2 w-full rounded-lg border border-foreground/15 bg-background/60 px-2.5 py-1.5 text-xs text-foreground/80 outline-none focus:border-gold"
              >
                <option value="">Tilldela städare</option>
                {STAFF_MEMBERS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              {r.last_cleaned_at && (
                <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-foreground/40">
                  Städat {timeAgo(r.last_cleaned_at)} sedan
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
 * Minibar
 * ===================================================================== */

function MinibarSection({
  tickets,
  guestsByRoom,
}: {
  tickets: Ticket[];
  guestsByRoom: Map<string, { name: string; email: string; phone: string }>;
}) {
  return (
    <div>
      <SectionHeader
        kicker="Minibar"
        title={<>Debiteringar & <span className="italic text-gold">avstämning</span></>}
      />
      <p className="mt-2 max-w-xl text-sm text-foreground/55">
        Rapporter från städpersonal som upptäckt konsumerade minibarvaror. Markera som klar när posten lagts på gästens nota.
      </p>
      <div className="mt-6">
        <TicketsSection
          tickets={tickets}
          loading={false}
          guestsByRoom={guestsByRoom}
          typeFilter="DEBITERA_MINIBAR"
          initialFilter="open"
        />
      </div>
    </div>
  );
}

/* =====================================================================
 * Checklists
 * ===================================================================== */

function ChecklistsSection({
  data,
  loading,
}: {
  data: { templates: { id: string; title: string; role: string; items: string[] }[]; completions: { template_id: string; item_index: number; checked_by: string | null }[] } | undefined;
  loading: boolean;
}) {
  const toggle = useServerFn(toggleChecklistItem);
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (v: { template_id: string; item_index: number; checked: boolean; checked_by?: string }) =>
      toggle({ data: v as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal-checklists"] }),
  });

  const [staff, setStaff] = useState<string>(STAFF_MEMBERS[0]);

  const done = new Set((data?.completions ?? []).map((c) => `${c.template_id}:${c.item_index}`));

  return (
    <div>
      <SectionHeader
        kicker="Checklistor"
        title={<>Dagens <span className="italic text-gold">rutiner</span></>}
      />

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">Signerar som</span>
        <select
          value={staff}
          onChange={(e) => setStaff(e.target.value)}
          className="bg-transparent text-xs font-medium text-foreground outline-none"
        >
          {STAFF_MEMBERS.map((s) => (
            <option key={s} value={s} className="bg-background">{s}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="mt-6 rounded-2xl border border-foreground/10 bg-foreground/5 p-8 text-center text-xs uppercase tracking-[0.3em] text-foreground/50">
          Laddar checklistor...
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {(data?.templates ?? []).map((tpl) => {
          const completed = tpl.items.filter((_, i) => done.has(`${tpl.id}:${i}`)).length;
          const pct = tpl.items.length ? Math.round((completed / tpl.items.length) * 100) : 0;
          return (
            <div key={tpl.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-gold">{tpl.role}</p>
                  <h3 className="mt-1 font-display text-lg font-medium text-foreground">{tpl.title}</h3>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-light text-foreground">{pct}%</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">{completed}/{tpl.items.length}</p>
                </div>
              </div>

              <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full bg-gradient-to-r from-gold to-gold-bright transition-all" style={{ width: `${pct}%` }} />
              </div>

              <ul className="mt-4 space-y-1.5">
                {tpl.items.map((label, i) => {
                  const key = `${tpl.id}:${i}`;
                  const isDone = done.has(key);
                  const by = data?.completions.find((c) => c.template_id === tpl.id && c.item_index === i)?.checked_by;
                  return (
                    <li key={i}>
                      <button
                        onClick={() => mutation.mutate({ template_id: tpl.id, item_index: i, checked: !isDone, checked_by: staff })}
                        className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                          isDone ? "border-emerald-400/20 bg-emerald-400/[0.04]" : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
                        }`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${isDone ? "border-emerald-400 bg-emerald-400/20" : "border-foreground/30"}`}>
                          {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-300" strokeWidth={2} />}
                        </span>
                        <span className={`flex-1 text-sm ${isDone ? "text-foreground/50 line-through" : "text-foreground/85"}`}>
                          {label}
                        </span>
                        {by && <span className="text-[10px] uppercase tracking-[0.15em] text-foreground/45">{by}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =====================================================================
 * Stats
 * ===================================================================== */

function StatsSection({ tickets, rooms }: { tickets: Ticket[]; rooms: Room[] }) {
  const byType = Object.entries(
    tickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.transaction_type] = (acc[t.transaction_type] ?? 0) + 1;
      return acc;
    }, {}),
  );

  const byStaff = Object.entries(
    tickets.reduce<Record<string, number>>((acc, t) => {
      if (t.status === "done" && t.assigned_to) acc[t.assigned_to] = (acc[t.assigned_to] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const dayCounts = last7Days.map((d) => {
    const count = tickets.filter((t) => {
      const td = new Date(t.created_at);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth() && td.getDate() === d.getDate();
    }).length;
    return { d, count };
  });
  const maxDay = Math.max(1, ...dayCounts.map((x) => x.count));

  const occupancy = rooms.length > 0 ? Math.round((rooms.filter((r) => r.status === "occupied").length / rooms.length) * 100) : 0;
  const cleanReady = rooms.length > 0 ? Math.round((rooms.filter((r) => r.status === "vacant_clean" || r.status === "inspected").length / rooms.length) * 100) : 0;
  const avgResolve = (() => {
    const closed = tickets.filter((t) => t.status === "done");
    if (!closed.length) return 0;
    const totalMin = closed.reduce((sum, t) => sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 60000, 0);
    return Math.round(totalMin / closed.length);
  })();

  return (
    <div>
      <SectionHeader kicker="Statistik" title={<>Drift & <span className="italic text-gold">prestation</span></>} />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <KpiCard label="Beläggning" value={occupancy} accent="text-foreground" icon={BedDouble} />
        <KpiCard label="Klara rum %" value={cleanReady} accent="text-emerald-300" icon={Sparkles} />
        <KpiCard label="Snitt lösningstid (min)" value={avgResolve} accent="text-sky-300" icon={Wrench} />
        <KpiCard label="Totalt antal ärenden" value={tickets.length} accent="text-amber-300" icon={TicketIcon} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
          <p className="font-display text-base font-medium text-foreground/90">Ärenden senaste 7 dagarna</p>
          <div className="mt-5 flex h-40 items-end justify-between gap-2">
            {dayCounts.map(({ d, count }) => (
              <div key={d.toISOString()} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-gold/30 to-gold transition-all"
                    style={{ height: `${(count / maxDay) * 100}%`, minHeight: count ? 4 : 2 }}
                  />
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-foreground/50">
                  {d.toLocaleDateString("sv-SE", { weekday: "short" })}
                </span>
                <span className="text-[11px] font-semibold text-foreground/80">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
          <p className="font-display text-base font-medium text-foreground/90">Ärenden per typ</p>
          <div className="mt-4 space-y-3">
            {byType.length === 0 && <p className="text-xs text-foreground/50">Ingen data</p>}
            {byType.map(([type, count]) => {
              const meta = typeMeta(type);
              const pct = Math.round((count / tickets.length) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/80">{meta.label}</span>
                    <span className="text-foreground/50">{count} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                    <div className={`h-full ${meta.bg.replace("/10", "/60")}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-5">
        <p className="font-display text-base font-medium text-foreground/90">Topplista — klara ärenden per personal</p>
        <div className="mt-4 space-y-2">
          {byStaff.length === 0 && <p className="text-xs text-foreground/50">Ingen data</p>}
          {byStaff.map(([name, n], i) => (
            <div key={name} className="flex items-center gap-3">
              <span className="w-6 text-center font-display text-sm text-foreground/40">{i + 1}</span>
              <span className="flex-1 text-sm text-foreground/85">{name}</span>
              <span className="font-display text-xl font-light text-gold">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* =====================================================================
 * Small shared bits
 * ===================================================================== */

function SectionHeader({ kicker, title }: { kicker: string; title: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">{kicker}</p>
      <h1 className="mt-2 font-display text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
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
