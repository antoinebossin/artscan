"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Artwork } from "@/lib/types";

export default function NewHuntPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [artworks, setArtworks] = useState<Artwork[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMsg("Connecte-toi pour créer une course.");
        setArtworks([]);
        return;
      }
      const { data } = await supabase
        .from("artworks")
        .select("*")
        .eq("owner_id", userData.user.id)
        .eq("type", "street")
        .order("scanned_at", { ascending: false });
      setArtworks((data as Artwork[]) ?? []);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selected.size === 0) {
      setMsg("Sélectionne au moins une œuvre.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      return;
    }
    const { data: hunt, error } = await supabase
      .from("hunts")
      .insert({
        creator_id: userData.user.id,
        name,
        description: description || null,
      })
      .select()
      .single();
    if (error || !hunt) {
      setMsg("Erreur : " + (error?.message ?? "création impossible"));
      setSaving(false);
      return;
    }
    const rows = Array.from(selected).map((artworkId) => ({
      hunt_id: hunt.id,
      artwork_id: artworkId,
    }));
    const { error: itemsErr } = await supabase
      .from("hunt_artworks")
      .insert(rows);
    setSaving(false);
    if (itemsErr) {
      setMsg("Erreur : " + itemsErr.message);
    } else {
      router.push("/hunts/" + hunt.id);
    }
  };

  return (
    <ThemeShell force="street">
      <p className="mt-4 text-xs opacity-60">
        <Link href="/hunts" className="underline">
          ← Courses
        </Link>
      </p>
      <h1
        className="mb-6 mt-1 text-2xl font-black uppercase"
        style={{ color: "var(--street-accent)" }}
      >
        Créer une course
      </h1>

      <form onSubmit={create} className="flex flex-col gap-4">
        <input
          required
          placeholder="Nom de la course (ex : Invaders du 13e)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border bg-transparent px-3 py-2"
        />
        <textarea
          placeholder="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="rounded border bg-transparent px-3 py-2"
        />

        <p className="text-sm opacity-80">
          Sélectionne les œuvres street art à retrouver ({selected.size}{" "}
          choisie(s)) :
        </p>
        {artworks === null && <p className="opacity-60">Chargement...</p>}
        {artworks !== null && artworks.length === 0 && (
          <p className="text-sm opacity-70">
            Aucune œuvre street art dans ta collection.{" "}
            <Link href="/scan" className="underline">
              Scanne d&apos;abord quelques œuvres !
            </Link>
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(artworks ?? []).map((a) => {
            const sel = selected.has(a.id);
            return (
              <button
                type="button"
                key={a.id}
                onClick={() => toggle(a.id)}
                className="relative overflow-hidden rounded-lg border-2"
                style={{ borderColor: sel ? "var(--street-accent)" : "transparent" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.photo_url}
                  alt={a.title ?? "Œuvre"}
                  className="aspect-square w-full object-cover"
                  style={{ opacity: sel ? 1 : 0.6 }}
                />
                {!a.lat && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                    sans GPS
                  </span>
                )}
                {sel && (
                  <span
                    className="absolute right-1 top-1 rounded-full px-1.5 text-xs font-bold"
                    style={{ background: "var(--street-accent)", color: "#000" }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-xs opacity-60">
          Les œuvres "sans GPS" n&apos;apparaîtront pas sur la carte et leurs
          trouvailles passeront en validation manuelle.
        </p>

        <button
          type="submit"
          disabled={saving || !name}
          className="rounded-full border px-4 py-3 font-bold disabled:opacity-40"
        >
          {saving ? "Création..." : "Créer la course"}
        </button>
      </form>
      {msg && <p className="mt-4 text-sm opacity-80">{msg}</p>}
    </ThemeShell>
  );
}
