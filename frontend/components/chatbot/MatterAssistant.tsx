import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Sparkles, Receipt, Wallet, BarChart3, Settings as SettingsIcon } from "lucide-react";
import chatbotIcon from "@/assets/matter-chatbot-icon.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const POS_KEY = "matteracc:assistant:pos";
const OPEN_KEY = "matteracc:assistant:open";

type Msg = { role: "user" | "bot"; text: string };

const QUICK_KEYS = [
  { icon: Receipt, key: "chatbot.quick.invoices" },
  { icon: Wallet, key: "chatbot.quick.expenses" },
  { icon: BarChart3, key: "chatbot.quick.reports" },
  { icon: SettingsIcon, key: "chatbot.quick.setting" },
];

const BTN = 80;
const PANEL_W = 340;
const PANEL_H = 460;
const MARGIN = 16;

const isBrowser = () => typeof window !== "undefined";

const getDefaultPosition = () => {
  if (!isBrowser()) {
    return { x: 24, y: 24 };
  }

  return { x: window.innerWidth - BTN - 24, y: window.innerHeight - BTN - 24 };
};

const clampToViewport = (x: number, y: number, w = BTN, h = BTN) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(MARGIN, Math.min(vw - w - MARGIN, x)),
    y: Math.max(MARGIN, Math.min(vh - h - MARGIN, y)),
  };
};

/**
 * Floating draggable assistant. Never permanently dismissed —
 * close button only minimises back to the floating mascot.
 */
export const MatterAssistant = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState<boolean>(() => (isBrowser() ? localStorage.getItem(OPEN_KEY) === "1" : false));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pos, setPos] = useState(() => {
    if (!isBrowser()) {
      return getDefaultPosition();
    }

    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return getDefaultPosition();
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const movedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist open + position
  useEffect(() => {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [open]);
  useEffect(() => {
    localStorage.setItem(POS_KEY, JSON.stringify(pos));
  }, [pos]);

  // Keep within viewport on resize
  useEffect(() => {
    const onResize = () => setPos((p: { x: number; y: number }) => clampToViewport(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Autoscroll messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  // Drag handlers (pointer events, viewport-clamped)
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (open) return; // only drag the floating button
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      movedRef.current = false;
      dragStart.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      setDragging(true);
    },
    [open, pos.x, pos.y]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    setPos(clampToViewport(dragStart.current.px + dx, dragStart.current.py + dy));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      dragStart.current = null;
      setDragging(false);
      // Treat as click only if not dragged
      if (!movedRef.current) setOpen(true);
    },
    []
  );

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "bot",
        text: "Thanks! I'll help you with that. (Demo response — connect Lovable AI Gateway to enable real answers.)",
      },
    ]);
    setInput("");
  };

  // Anchor panel to button position, but flip when too close to edges
  const panelStyle = (() => {
    if (!isBrowser()) {
      return { left: pos.x, top: pos.y };
    }

    const right = window.innerWidth - pos.x - BTN < PANEL_W + MARGIN;
    const top = pos.y < PANEL_H + MARGIN;
    const left = right ? Math.max(MARGIN, pos.x + BTN - PANEL_W) : pos.x;
    const yTop = top ? pos.y + BTN + 12 : pos.y - PANEL_H - 12;
    return { left, top: Math.max(MARGIN, Math.min(window.innerHeight - PANEL_H - MARGIN, yTop)) };
  })();

  return (
    <>
      {/* Floating mascot button — always present */}
      <motion.div
        className="fixed z-[60]"
        style={{ left: pos.x, top: pos.y }}
        animate={{ scale: dragging ? 1.08 : open ? 0.85 : 1, opacity: open ? 0 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22 }}
      >
        <button
          data-tour="assistant"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Open Matter assistant"
          className={cn(
            "group relative outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full",
            dragging ? "cursor-grabbing" : "cursor-grab",
            open && "pointer-events-none"
          )}
          style={{ width: BTN, height: BTN, touchAction: "none" }}
        >
          {/* Soft green aura — no white plate */}
          <span className="absolute inset-0 rounded-full bg-primary/35 blur-2xl opacity-80 group-hover:opacity-100 transition-opacity" aria-hidden />
          <span className="absolute inset-[-6px] rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.35),transparent_70%)] blur-md" aria-hidden />
          <span
            className={cn(
              "relative flex items-center justify-center w-full h-full transition-transform",
              !dragging && "group-hover:scale-110"
            )}
          >
            <img
              src={chatbotIcon.src}
              alt="Matter Assistant"
              draggable={false}
              className="w-full h-full object-contain select-none pointer-events-none drop-shadow-[0_4px_16px_hsl(var(--primary)/0.45)]"
            />
            <span className="absolute top-1 right-1 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
          </span>
        </button>
      </motion.div>

      {/* Compact chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="fixed z-[70] bg-card border border-border rounded-2xl shadow-premium overflow-hidden flex flex-col"
            style={{
              left: panelStyle.left,
              top: panelStyle.top,
              width: PANEL_W,
              height: PANEL_H,
              transformOrigin: "bottom right",
            }}
          >
            {/* Header */}
            <div className="relative bg-gradient-brand px-4 py-3 text-primary-foreground flex items-center gap-3">
              <div className="absolute inset-0 gradient-mesh opacity-40 mix-blend-overlay pointer-events-none" />
              <div className="relative h-9 w-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden ring-2 ring-white/20">
                <img src={chatbotIcon.src} alt="" draggable={false} className="w-8 h-8 object-contain select-none" />
              </div>
              <div className="relative flex-1 min-w-0">
                <p className="font-display font-bold text-sm leading-tight truncate">{t("chatbot.name")}</p>
                <p className="text-[10px] text-white/75 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Online
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="relative h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
                aria-label="Minimise"
                title="Minimise"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 bg-gradient-to-b from-background to-card">
              {messages.length === 0 ? (
                <>
                  {/* Welcome */}
                  <div className="bg-card rounded-xl border border-border/60 px-3 py-2.5 mb-3 shadow-sm">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-primary mb-1">
                      <Sparkles className="h-3 w-3" /> {t("chatbot.name")}
                    </div>
                    <p className="text-xs leading-relaxed">
                      {t("chatbot.welcome")}
                    </p>
                  </div>

                  {/* Quick prompts */}
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 px-1">
                    {t("common.quickCreate")}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_KEYS.map((q) => {
                      const Icon = q.icon;
                      const label = t(q.key);
                      return (
                        <button
                          key={q.key}
                          onClick={() => send(label)}
                          className="flex flex-col items-start gap-1 px-2.5 py-2 rounded-lg border border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5 transition text-left"
                        >
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <span className="text-[11px] font-medium leading-tight">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[82%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed",
                          m.role === "user"
                            ? "bg-gradient-brand text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        )}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-border p-2 flex items-center gap-1.5 bg-card"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("chatbot.placeholder")}
                className="h-8 text-xs bg-secondary/60 border-transparent focus-visible:bg-card"
              />
              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 shrink-0 bg-gradient-brand text-primary-foreground border-0"
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
