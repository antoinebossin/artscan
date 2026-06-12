"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeShell, { getSavedMode } from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<"street" | "museum">("street");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [locationText, setLocationText] = useState("");
  const [museum, setMuseum] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setType(getSavedMode());
  }, []);

  const onFile = (f: File | null) => {
    setFile(f);
    setDone(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus("GPS non supporté par ce navigateur.");
      return;
    }
    setStatus("Localisation en cours...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus(null);
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: "Accès à la position refusé. Autorise la localisation pour artscan.vercel.app dans les réglages de ton navigateur (iPhone : Réglages > Safari > Position).",
          2: "Position indisponible. Active le GPS puis réessaie.",
          3: "Délai dépassé. Réessaie, idéalement en extérieur.",
        };
        setStatus(msgs[err.code] ?? "Erreur de localisation inconnue.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setStatus(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setStatus("Connecte-toi d'abord pour enregistrer une œuvre.");
        setSaving(false);
        return;
      }
      const blob = await compressImage(file);
      const path = user.id + "/" + crypto.randomUUID() + ".jpg";
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const { error: insErr } = await supabase.from("artworks").insert({
        owner_id: user.id,
        type,
        photo_url: pub.publicUrl,
        title: title || null,
        artist_name: artist || null,
        location_text: locationText || null,
        museum_name: type === "museum" ? museum || null : null,
        notes: notes || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      if (insErr) throw insErr;
      setDone(true);
      setStatus(null);
      onFile(null);
      setTitle("");
      setArtist("");
      setNotes("");
    } catch (err) {
      setStatus("Erreur : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemeShell>
      <h1 className="mb-6 mt-4 text-2xl font-bold">Scanner une œuvre</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 text-sm opacity-90">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Aperçu" className="max-h-72 rounded" />
          ) : (
            <span>Choisir ou prendre une photo</span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>

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
          placeholder="Titre (optionnel)"
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
            placeholder="Musée (ex : Louvre)"
            value={museum}
            onChange={(e) => setMuseum(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
        ) : (
          <input
            placeholder="Lieu (ex : Paris 13e, Butte-aux-Cailles)"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
        )}
        <textarea
          placeholder="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="rounded border bg-transparent px-3 py-2"
        />

        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={locate}
            className="rounded-full border px-4 py-2"
          >
            {coords ? "Position enregistrée ✓" : "Utiliser ma position GPS"}
          </button>
          {coords && (
            <span className="opacity-60">
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          )}
        </div>

        <button
          type="submit"
          disabled={!file || saving}
          className="rounded-full border px-4 py-3 font-bold disabled:opacity-40"
        >
          {saving ? "Enregistrement..." : "Enregistrer l'œuvre"}
        </button>
      </form>
      {status && <p className="mt-4 text-sm opacity-80">{status}</p>}
      {done && (
        <p className="mt-4 text-sm">
          Œuvre enregistrée !{" "}
          <Link href="/collection" className="underline">
            Voir ma collection
          </Link>
        </p>
      )}
    </ThemeShell>
  );
}
