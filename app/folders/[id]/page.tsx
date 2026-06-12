"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Artwork, Folder } from "@/lib/types";

type Item = { artwork_id: string; artworks: Artwork };

export default function FolderDetailPage() {
  const params = useParams<{ id: string }>();
  const [folder, setFolder] = useState<Folder | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const supabase = createClient();

  const load = async () => {
    const [f, i] = await Promise.all([
      supabase.from("folders").select("*").eq("id", params.id).single(),
      supabase
        .from("folder_items")
        .select("artwork_id, artworks(*)")
        .eq("folder_id", params.id),
    ]);
    setFolder(f.data as Folder | null);
    setItems((i.data as unknown as Item[]) ?? []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const remove = async (artworkId: string) => {
    await supabase
      .from("folder_items")
      .delete()
      .eq("folder_id", params.id)
      .eq("artwork_id", artworkId);
    load();
  };

  return (
    <ThemeShell>
      <p className="mt-4 text-xs opacity-60">
        <Link href="/folders" className="underline">
          ← Mes dossiers
        </Link>
      </p>
      <h1 className="mb-6 mt-1 text-2xl font-bold">
        {folder ? folder.name : "..."}
      </h1>

      {items !== null && items.length === 0 && (
        <p className="opacity-70">
          Dossier vide. Ajoute des œuvres depuis{" "}
          <Link href="/collection" className="underline">
            ta collection
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(items ?? []).map(({ artwork_id, artworks: a }) => (
          <div key={artwork_id} className="overflow-hidden rounded-lg border">
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
              </span>
              <button
                onClick={() => remove(artwork_id)}
                className="mt-1 self-start rounded-full border px-2 py-0.5 opacity-70"
              >
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>
    </ThemeShell>
  );
}
