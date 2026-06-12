"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Hunt } from "@/lib/types";

export default function HuntsPage() {
  const [created, setCreated] = useState<Hunt[] | null>(null);
  const [joined, setJoined] = useState<Hunt[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        setMsg("Connecte-toi pour voir tes courses.");
        setCreated([]);
        return;
      }
      const [c, j] = await Promise.all([
        supabase
          .from("hunts")
          .select("*")
          .eq("creator_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("hunt_participants")
          .select("hunts(*)")
          .eq("user_id", user.id),
      ]);
      setCreated((c.data as Hunt[]) ?? []);
      const joinedHunts = ((j.data as unknown as { hunts: Hunt | null }[]) ?? [])
        .map((r) => r.hunts)
        .filter((h): h is Hunt => h !== null);
      setJoined(joinedHunts);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMsg("Connecte-toi d'abord.");
      return;
    }
    const { data: hunt } = await supabase
      .from("hunts")
      .select("id")
      .eq("share_code", code.trim().toLowerCase())
      .single();
    if (!hunt) {
      setMsg("Code introuvable. Vérifie que la course est bien publiée.");
      return;
    }
    await supabase
      .from("hunt_participants")
      .upsert(
        { hunt_id: hunt.id, user_id: userData.user.id },
        { onConflict: "hunt_id,user_id" }
      );
    router.push("/hunts/" + hunt.id);
  };

  const list = (hunts: Hunt[], empty: string) =>
    hunts.length === 0 ? (
      <p className="text-sm opacity-60">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {hunts.map((h) => (
          <li key={h.id}>
            <Link
              href={"/hunts/" + h.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="font-bold">{h.name}</span>
              <span className="text-xs opacity-60">
                {h.is_published ? "Publiée" : "Brouillon"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <ThemeShell>
      <div className="mb-6 mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
        <Link
          href="/hunts/new"
          className="rounded-full border-2 px-4 py-2 text-sm font-bold"
        >
          + Créer une course
        </Link>
      </div>

      {msg && <p className="mb-3 text-sm opacity-80">{msg}</p>}

      <form onSubmit={join} className="mb-8 flex gap-2">
        <input
          required
          placeholder="Code d'invitation (ex : a3f8c2d1)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="flex-1 rounded border bg-transparent px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-full border px-4 py-2 text-sm font-bold">
          Rejoindre
        </button>
      </form>

      <h2 className="mb-2 text-lg font-bold">Mes courses créées</h2>
      <div className="mb-8">
        {created === null ? (
          <p className="text-sm opacity-60">Chargement...</p>
        ) : (
          list(created, "Aucune course créée pour l'instant.")
        )}
      </div>

      <h2 className="mb-2 text-lg font-bold">Courses rejointes</h2>
      {list(joined, "Tu n'as rejoint aucune course. Demande un code à un ami !")}
    </ThemeShell>
  );
}
