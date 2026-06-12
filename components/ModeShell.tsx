"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSavedMode, type Mode } from "@/components/ThemeShell";

export default function ModeShell({
  render,
}: {
  render: (mode: Mode) => React.ReactNode;
}) {
  const [mode, setModeState] = useState<Mode>("street");
  const [email, setEmail] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const saved = getSavedMode();
    setModeState(saved);
    const el = containerRef.current;
    if (el && saved === "museum") {
      el.scrollTo({ left: el.clientWidth });
    }
    const onScroll = () => {
      if (!el) return;
      const m: Mode = el.scrollLeft > el.clientWidth / 2 ? "museum" : "street";
      setModeState((prev) => {
        if (prev !== m) window.localStorage.setItem("artscan-mode", m);
        return m;
      });
    };
    el?.addEventListener("scroll", onScroll, { passive: true });

    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      el?.removeEventListener("scroll", onScroll);
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (m: Mode) => {
    const el = containerRef.current;
    el?.scrollTo({
      left: m === "street" ? 0 : el.clientWidth,
      behavior: "smooth",
    });
  };

  const street = mode === "street";
  const accent = street ? "var(--street-accent)" : "var(--museum-accent)";

  return (
    <div
      className={(street ? "theme-street" : "theme-museum") + " flex h-dvh flex-col"}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 text-sm">
        <Link
          href="/"
          className={street ? "font-black uppercase" : "italic font-bold"}
          style={{ color: accent }}
        >
          ArtScan
        </Link>
        <nav className="flex gap-3 opacity-90">
          <Link href="/scan">Scanner</Link>
          <Link href="/collection">Collection</Link>
          <Link href="/folders">Dossiers</Link>
          <Link href="/hunts">Courses</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => goTo(street ? "museum" : "street")}
            className="rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: accent, color: accent }}
          >
            {street ? "Mode musée →" : "← Mode street"}
          </button>
          {email ? (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/");
                router.refresh();
              }}
              className="text-xs underline opacity-70"
            >
              Déconnexion
            </button>
          ) : (
            <Link href="/login" className="text-xs underline opacity-70">
              Connexion
            </Link>
          )}
        </div>
      </header>
      <div ref={containerRef} className="mode-swipe">
        <section className="mode-panel theme-street px-5 pb-16">
          <div className="mx-auto w-full max-w-3xl">{render("street")}</div>
        </section>
        <section className="mode-panel theme-museum px-5 pb-16">
          <div className="mx-auto w-full max-w-3xl">{render("museum")}</div>
        </section>
      </div>
    </div>
  );
}
