"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ModeShell from "@/components/ModeShell";
import type { Mode } from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Artwork, Folder } from "@/lib/types";

export default function CollectionPage() {
  const [artworks, setArtworks] = useState<Artwork[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
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

  const panel = (mode: Mode) => {
    const shown = (artworks ?? []).filter((a) => a.type === mode);
    const modeFolders = folders.filter((f) => f.mode === mode);
    return (
      <>
        <h1 className="mb-4 mt-4 text-2xl font-bold">
          {mode === "street" ? "Collection street art" : "Collection musée"}
        </h1>
        {msg && <p className="mb-3 text-sm opacity-80">{msg}</p>}
        {artworks === null && <p className="opacity-60">Chargement...</p>}
        {artworks !== null && shown.length === 0 && (
          <p className="opacity-70">
            Aucune œuvre de ce côté pour l&apos;instant.{" "}
            <Link href="/scan" className="underline">
              Scanner une œuvre
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
                <span className="font-bold">{a.title || "Sans titre"}</span>
                <span className="opacity-70">
                  {a.artist_name || "Artiste inconnu"}
                  {a.type === "museum" && a.museum_name
                    ? " · " + a.museum_name
                    : a.location_text
                      ? " · " + a.location_text
                      : ""}
                </span>
                <span className="opacity-50">
                  {new Date(a.scanned_at).toLocaleDateString("fr-FR")}
                </span>
                <Link
                  href={"/artwork/" + a.id}
                  className="mt-1 self-start rounded-full border px-2 py-0.5 opacity-70"
                >
                  Modifier
                </Link>
                {modeFolders.length > 0 && (
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
                    {modeFolders.map((f) => (
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
      </>
    );
  };

  return <ModeShell render={panel} />;
}
