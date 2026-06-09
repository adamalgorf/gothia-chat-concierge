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
    <div className="flex h-[calc(100dvh-80px)] flex-col">
      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-2xl space-y-8">
          {isEmpty && (
            <div className="flex flex-col items-start pt-6 sm:pt-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-gold">
                Digital concierge
              </p>
              <h2 className="mt-5 font-display text-4xl font-light leading-[0.95] tracking-tight text-foreground sm:text-5xl">
                Välkommen <span className="italic text-gold">tillbaka</span>.
              </h2>
              <p className="mt-5 max-w-md text-base text-foreground/70">
                Jag är din personliga receptionist. Be om vad som helst – från frukosttider till taxibokning.
              </p>

              <div className="mt-10 w-full">
                <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.35em] text-foreground/45">
                  Förslag
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="group flex items-center justify-between gap-3 rounded-full border border-foreground/15 bg-foreground/5 px-5 py-3.5 text-left text-sm text-foreground/85 backdrop-blur-md transition-all hover:border-gold/50 hover:bg-foreground/10 hover:text-foreground active:scale-[0.98]"
                    >
                      <span>{s}</span>
                      <Sparkles className="h-3.5 w-3.5 text-gold/60 transition-colors group-hover:text-gold" strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
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
              <div key={m.id} className="space-y-2.5">
                <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  {isUser ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-foreground backdrop-blur-md">
                      {text}
                    </div>
                  ) : (
                    text && (
                      <div className="max-w-[92%] text-[15px] leading-relaxed text-foreground/90">
                        <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.35em] text-gold/70">
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
                    <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.25em] text-gold">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                      Mottaget av hotellet
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex justify-start animate-fade-in">
              <div className="flex items-center gap-2.5 rounded-full border border-foreground/15 bg-foreground/5 px-4 py-2 backdrop-blur-md">
                <div className="flex items-center gap-1">
                  <span className="h-1 w-1 animate-pulse rounded-full bg-gold" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-gold [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-pulse rounded-full bg-gold [animation-delay:300ms]" />
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-gold/80">
                  Skriver
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
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-foreground/20 bg-foreground/5 text-gold backdrop-blur-md transition-all hover:border-gold/50 hover:scale-105"
            aria-label="Scrolla till toppen"
            title="Scrolla till toppen"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>


      {/* Composer */}
      <div className="border-t border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-5 py-4 sm:px-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-full border border-foreground/15 bg-foreground/5 px-2.5 py-1.5 backdrop-blur-md transition-colors focus-within:border-gold/50"
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
              className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-4 py-2.5 text-[15px] text-foreground placeholder:text-foreground/40 focus:outline-none"
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                title={listening ? "Stoppa inspelning" : "Talindata"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all ${
                  listening
                    ? "border-gold bg-gold/20 text-gold"
                    : "border-foreground/15 text-foreground/60 hover:border-gold/50 hover:text-gold"
                }`}
              >
                {listening ? <MicOff className="h-4 w-4" strokeWidth={1.75} /> : <Mic className="h-4 w-4" strokeWidth={1.75} />}
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground transition-all hover:bg-gold-bright disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send className="h-4 w-4" strokeWidth={2} />
            </button>
          </form>
          <p className="mt-3 text-center text-[9px] uppercase tracking-[0.4em] text-foreground/35">
            Enter skickar · Shift+Enter ny rad
          </p>
        </div>
      </div>
    </div>
  );
}
