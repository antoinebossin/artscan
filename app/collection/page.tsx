"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Artwork, Folder } from "@/lib/types";

export default function CollectionPage() {
  const [artworks, setArtworks] = useState<Artwork[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filter, setFilter] = useState<"all" | "street" | "museum">("all");
  const [msg, setMsg] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMsg("Connecte-toi pour voir ta collection.");
        setArtworks([]);
        return;
      }
      const [a, f] = await Promise.all([
        supabase
          .from("artworks")
          .select("*")
          .eq("owner_id", userData.user.id)
          .order("scanned_at", { ascending: false }),
        supabase.from("folders").select("*").order("name"),
      ]);
      setArtworks((a.data as Artwork[]) ?? []);
      setFolders((f.data as Folder[]) ?? []);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addToFolder = async (artworkId: string, folderId: string) => {
    const { error } = await supabase
      .from("folder_items")
      .upsert(
        { folder_id: folderId, artwork_id: artworkId },
        { onConflict: "folder_id,artwork_id" }
      );
    setMsg(error ? "Erreur : " + error.message : "Ajouté au dossier ✓");
    setTimeout(() => setMsg(null), 2500);
  };

  const shown = (artworks ?? []).filter(
    (a) => filter === "all" || a.type === filter
  );

  return (
    <ThemeShell>
      <div className="mb-4 mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ma collection</h1>
        <div className="flex gap-1 text-xs">
          {(["all", "street", "museum"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="rounded-full border px-3 py-1"
              style={{ opacity: filter === f ? 1 : 0.5 }}
            >
              {f === "all" ? "Tout" : f === "street" ? "Street" : "Musée"}
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="mb-3 text-sm opacity-80">{msg}</p>}
      {artworks === null && <p className="opacity-60">Chargement...</p>}
      {artworks !== null && shown.length === 0 && (
        <p className="opacity-70">
          Aucune œuvre pour l&apos;instant.{" "}
          <Link href="/scan" className="underline">
            Scanner ma première œuvre
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {shown.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.photo_url}
              alt={a.title ?? "Œuvre"}
              className="aspect-square w-full object-cover"
            />
            <div className="flex flex-col gap-1 p-2 text-xs">
              <span className="font-bold">
                {a.title || "Sans titre"}
              </span>
              <span className="opacity-70">
                {a.artist_name || "Artiste inconnu"}
                {a.type === "museum" && a.museum_name
                  ? " · " + a.museum_name
                  : a.location_text
                    ? " · " + a.location_text
                    : ""}
              </span>
              <span className="opacity-50">
                {a.type === "street" ? "Street art" : "Musée"} ·{" "}
                {new Date(a.scanned_at).toLocaleDateString("fr-FR")}
              </span>
              {folders.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) addToFolder(a.id, e.target.value);
                    e.target.value = "";
                  }}
                  className="mt-1 rounded border bg-transparent px-1 py-0.5"
                >
                  <option value="" disabled>
                    + Ajouter à un dossier
                  </option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </ThemeShell>
  );
}
