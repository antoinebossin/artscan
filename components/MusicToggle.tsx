"use client";

import { useEffect, useRef, useState } from "react";

export default function MusicToggle({
  mode,
}: {
  mode: "street" | "museum";
}) {
  const [available, setAvailable] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const src = "/audio/" + mode + ".mp3";

  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((r) => {
        if (!cancelled) setAvailable(r.ok);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (a && playing && !a.src.endsWith(src)) {
      a.src = src;
      a.play().catch(() => setPlaying(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  const toggle = async () => {
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.loop = true;
      a.volume = 0.5;
      audioRef.current = a;
    }
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    if (!a.src.endsWith(src)) a.src = src;
    try {
      await a.play();
      setPlaying(true);
    } catch {
      // lecture refusée par le navigateur
    }
  };

  if (!available) return null;
  return (
    <button
      onClick={toggle}
      aria-label={playing ? "Couper la musique" : "Lancer la musique"}
      className="rounded-full border px-3 py-1 text-xs"
      style={{ opacity: playing ? 1 : 0.6 }}
    >
      {playing ? "♪ on" : "♪ off"}
    </button>
  );
}
