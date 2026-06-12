"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"street" | "museum">("street");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      setMode(el.scrollLeft > el.clientWidth / 2 ? "museum" : "street");
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (target: "street" | "museum") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      left: target === "street" ? 0 : el.clientWidth,
      behavior: "smooth",
    });
  };

  return (
    <main>
      <div ref={containerRef} className="swipe-container">
        <section className="swipe-panel theme-street flex flex-col items-center justify-center gap-6 px-8 text-center">
          <p
            className="text-sm uppercase tracking-[0.3em]"
            style={{ color: "var(--street-accent-2)" }}
          >
            Street art
          </p>
          <h1
            className="text-5xl font-black uppercase"
            style={{ color: "var(--street-accent)" }}
          >
            ArtScan
          </h1>
          <p className="max-w-sm opacity-80">
            Scanne les œuvres dans la rue, collectionne-les par artiste et par
            quartier, défie tes amis dans des chasses au street art.
          </p>
          <p className="text-xs opacity-50">
            Swipe à droite pour le côté musée →
          </p>
          <button
            onClick={() => goTo("museum")}
            className="rounded-full border px-6 py-2 text-sm"
            style={{ borderColor: "var(--street-accent)", color: "var(--street-accent)" }}
          >
            Côté musée
          </button>
          <div className="flex gap-4 text-sm underline opacity-80">
            <Link href="/scan">Scanner</Link>
            <Link href="/collection">Ma collection</Link>
            <Link href="/folders">Dossiers</Link>
          </div>
        </section>

        <section className="swipe-panel theme-museum flex flex-col items-center justify-center gap-6 px-8 text-center">
          <p
            className="text-sm uppercase tracking-[0.3em]"
            style={{ color: "var(--museum-accent-2)" }}
          >
            Musée
          </p>
          <h1
            className="text-5xl italic"
            style={{ color: "var(--museum-accent)" }}
          >
            ArtScan
          </h1>
          <p className="max-w-sm opacity-80">
            Photographie les œuvres au musée, identifie artiste et titre, et
            compose tes collections par musée, artiste ou thème.
          </p>
          <p className="text-xs opacity-50">
            ← Swipe à gauche pour le street art
          </p>
          <button
            onClick={() => goTo("street")}
            className="rounded-full border px-6 py-2 text-sm"
            style={{ borderColor: "var(--museum-accent)", color: "var(--museum-accent)" }}
          >
            Côté street art
          </button>
          <div className="flex gap-4 text-sm underline opacity-80">
            <Link href="/scan">Scanner</Link>
            <Link href="/collection">Ma collection</Link>
            <Link href="/folders">Dossiers</Link>
          </div>
        </section>
      </div>

      <div
        className="pointer-events-none fixed bottom-4 left-1/2 flex -translate-x-1/2 gap-2"
        aria-hidden
      >
        <span
          className="h-2 w-2 rounded-full transition-opacity"
          style={{
            background: mode === "street" ? "var(--street-accent)" : "#999",
            opacity: mode === "street" ? 1 : 0.4,
          }}
        />
        <span
          className="h-2 w-2 rounded-full transition-opacity"
          style={{
            background: mode === "museum" ? "var(--museum-accent)" : "#999",
            opacity: mode === "museum" ? 1 : 0.4,
          }}
        />
      </div>
    </main>
  );
}
