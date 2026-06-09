import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronUp, Mic, MicOff, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface GuestChatProps {
  roomNumber: string;
  initialMessages: UIMessage[];
  onBookingConfirmed?: (bookingNumber: string) => void;
  autoPrompt?: string;
}

// Minimal typing for browser SpeechRecognition
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const SUGGESTIONS = [
  "Vad är frukosttiderna?",
  "Boka taxi kl 18:00",
  "Spa-öppettider idag",
  "Restaurangrekommendation",
];

export function GuestChat({ roomNumber, initialMessages, onBookingConfirmed, autoPrompt }: GuestChatProps) {
  const roomRef = useRef(roomNumber);
  useEffect(() => {
    roomRef.current = roomNumber;
  }, [roomNumber]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, id }) => ({
          body: { messages, id, roomNumber: roomRef.current },
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: "gothia-session",
    messages: initialMessages,
    transport,
  });

  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceSupported = useMemo(() => getRecognition() !== null, []);
  const seenBookingsRef = useRef<Set<string>>(new Set());

  const isLoading = status === "submitted" || status === "streaming";

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollTop(el.scrollTop > 300);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [roomNumber, status]);

  // Detect booking confirmations from tool outputs and notify parent.
  useEffect(() => {
    if (!onBookingConfirmed) return;
    for (const m of messages) {
      for (const p of m.parts) {
        if (!p.type.startsWith("tool-")) continue;
        const out = (p as { output?: { booking_number?: string } }).output;
        const bn = out?.booking_number;
        if (bn && !seenBookingsRef.current.has(bn)) {
          seenBookingsRef.current.add(bn);
          onBookingConfirmed(bn);
        }
      }
    }
  }, [messages, onBookingConfirmed]);

  // Auto-send an initial prompt (e.g. trigger booking flow) on mount
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSentRef.current) return;
    if (!autoPrompt) return;
    if (messages.length > 0) return;
    autoSentRef.current = true;
    sendMessage({ text: autoPrompt });
  }, [autoPrompt, messages.length, sendMessage]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInput("");
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = "sv-SE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-64px)] flex-col">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {isEmpty && (
            <div className="flex flex-col items-center pt-8 text-center">
              <div className="rounded-full border border-gold/30 bg-surface p-4">
                <Sparkles className="h-6 w-6 text-gold" strokeWidth={1.5} />
              </div>
              <h2 className="mt-5 font-display text-2xl font-light text-foreground">
                Välkommen tillbaka
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Jag är din personliga Guest AI Receptionist. Hur kan jag hjälpa dig under din vistelse?
              </p>
              <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-foreground/90 transition-all hover:border-gold/40 hover:bg-surface-elevated"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            const isUser = m.role === "user";
            const confirmations = m.parts.filter((p) => {
              if (!p.type.startsWith("tool-")) return false;
              const out = (p as { output?: { ok?: boolean } }).output;
              return out?.ok === true;
            });
            return (
              <div key={m.id} className="space-y-2">
                <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {isUser ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gold/15 px-4 py-3 text-sm text-foreground ring-1 ring-gold/25">
                      {text}
                    </div>
                  ) : (
                    text && (
                      <div className="max-w-[90%] text-sm leading-relaxed text-foreground/90">
                        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.25em] text-gold/70">
                          Receptionist
                        </div>
                        <div className="markdown-body">
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      </div>
                    )
                  )}
                </div>
                {confirmations.map((_, i) => (
                  <div key={i} className="flex justify-start animate-fade-in">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Mottaget av hotellet
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-center gap-2.5 rounded-2xl border border-gold/20 bg-surface/70 px-3.5 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold/80" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold/80 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold/80 [animation-delay:300ms]" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-gold/70">
                  AI-receptionisten skriver
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              Något gick fel. Försök igen om en stund.
            </div>
          )}
        </div>

        {/* Scroll to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 bg-surface/90 text-gold shadow-lg backdrop-blur-md transition-all hover:bg-surface-elevated hover:scale-105"
            aria-label="Scrolla till toppen"
            title="Scrolla till toppen"
          >
            <ChevronUp className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2 focus-within:border-gold/50"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={listening ? "Lyssnar..." : "Skriv ett meddelande..."}
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                title={listening ? "Stoppa inspelning" : "Talindata"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                  listening
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-border text-muted-foreground hover:border-gold/40 hover:text-gold"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-gold-foreground transition-all hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
            Tryck Enter för att skicka · Shift+Enter för ny rad
          </p>
        </div>
      </div>
    </div>
  );
}
