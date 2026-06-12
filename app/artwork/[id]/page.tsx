"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import { detectArtwork } from "@/lib/detect";
import type { Artwork } from "@/lib/types";

export default function ArtworkEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [type, setType] = useState<"street" | "museum">("street");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [locationText, setLocationText] = useState("");
  const [museum, setMuseum] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("artworks")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        const a = data as Artwork | null;
        if (!a) {
          setStatus("Œuvre introuvable (es-tu connecté ?)");
          return;
        }
        setArtwork(a);
        setType(a.type);
        setTitle(a.title ?? "");
        setArtist(a.artist_name ?? "");
        setLocationText(a.location_text ?? "");
        setMuseum(a.museum_name ?? "");
        setNotes(a.notes ?? "");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const detect = async () => {
    if (!artwork) return;
    setDetecting(true);
    setStatus(null);
    try {
      const res = await fetch(artwork.photo_url);
      const blob = await res.blob();
      const d = await detectArtwork(blob, type);
      if (d.artist) setArtist(d.artist);
      if (d.title) setTitle(d.title);
      const conf = { high: "élevée", medium: "moyenne", low: "faible" }[
        d.confidence
      ] ?? d.confidence;
      setStatus(
        "IA : " +
          (d.artist ?? "artiste non identifié") +
          (d.title ? " — " + d.title : "") +
          " (confiance " + conf + ")" +
          (d.note ? " · " + d.note : "")
      );
    } catch (err) {
      setStatus(
        "Erreur IA : " + (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setDetecting(false);
    }
  };

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("artworks")
      .update({
        type,
        title: title || null,
        artist_name: artist || null,
        location_text: locationText || null,
        museum_name: type === "museum" ? museum || null : null,
        notes: notes || null,
      })
      .eq("id", params.id);
    setSaving(false);
    if (error) {
      setStatus("Erreur : " + error.message);
    } else {
      setStatus("Modifications enregistrées ✓");
      setTimeout(() => setStatus(null), 2500);
    }
  };

  const remove = async () => {
    if (!artwork) return;
    if (!window.confirm("Supprimer définitivement cette œuvre ?")) return;
    const path = artwork.photo_url.split("/photos/")[1];
    if (path) {
      await supabase.storage.from("photos").remove([decodeURIComponent(path)]);
    }
    const { error } = await supabase
      .from("artworks")
      .delete()
      .eq("id", params.id);
    if (error) {
      setStatus("Erreur : " + error.message);
    } else {
      router.push("/collection");
    }
  };

  return (
    <ThemeShell>
      <p className="mt-4 text-xs opacity-60">
        <Link href="/collection" className="underline">
          ← Ma collection
        </Link>
      </p>
      <h1 className="mb-6 mt-1 text-2xl font-bold">Modifier l&apos;œuvre</h1>

      {artwork && (
        <form onSubmit={save} className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artwork.photo_url}
            alt={title || "Œuvre"}
            className="max-h-80 self-center rounded-lg"
          />

          <button
            type="button"
            onClick={detect}
            disabled={detecting}
            className="rounded-full border-2 px-4 py-2 text-sm font-bold disabled:opacity-40"
          >
            {detecting ? "Analyse en cours..." : "✨ Identifier avec l'IA"}
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setType("street")}
              className="flex-1 rounded-full border px-4 py-2 text-sm"
              style={{ opacity: type === "street" ? 1 : 0.5 }}
            >
              Street art
            </button>
            <button
              type="button"
              onClick={() => setType("museum")}
              className="flex-1 rounded-full border px-4 py-2 text-sm"
              style={{ opacity: type === "museum" ? 1 : 0.5 }}
            >
              Musée
            </button>
          </div>

          <input
            placeholder="Titre"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
          <input
            placeholder="Artiste (laisser vide si inconnu)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
          {type === "museum" ? (
            <input
              placeholder="Musée"
              value={museum}
              onChange={(e) => setMuseum(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
            />
          ) : (
            <input
              placeholder="Lieu"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="rounded border bg-transparent px-3 py-2"
            />
          )}
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded border bg-transparent px-3 py-2"
          />

          <button
            type="submit"
            disabled={saving}
            className="rounded-full border px-4 py-3 font-bold disabled:opacity-40"
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
          <button
            type="button"
            onClick={remove}
            className="self-center text-xs underline opacity-60"
          >
            Supprimer l&apos;œuvre
          </button>
        </form>
      )}
      {status && <p className="mt-4 text-sm opacity-80">{status}</p>}
    </ThemeShell>
  );
}
