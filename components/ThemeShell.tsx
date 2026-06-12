"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Mode = "street" | "museum";

export function getSavedMode(): Mode {
  if (typeof window === "undefined") return "street";
  return window.localStorage.getItem("artscan-mode") === "museum"
    ? "museum"
    : "street";
}

export default function ThemeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<Mode>("street");
  const [email, setEmail] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setModeState(getSavedMode());
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    window.localStorage.setItem("artscan-mode", m);
  };

  const street = mode === "street";
  const accent = street ? "var(--street-accent)" : "var(--museum-accent)";

  return (
    <div className={(street ? "theme-street" : "theme-museum") + " min-h-dvh"}>
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
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setMode(street ? "museum" : "street")}
            className="rounded-full border px-3 py-1 text-xs"
            style={{ borderColor: accent, color: accent }}
          >
            {street ? "Mode musée" : "Mode street"}
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
      <main className="mx-auto w-full max-w-3xl px-5 pb-16">{children}</main>
    </div>
  );
}
