"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";
import type { Folder } from "@/lib/types";

const CATEGORIES = [
  { value: "artiste", label: "Artiste" },
  { value: "lieu", label: "Lieu" },
  { value: "musee", label: "Musée" },
  { value: "theme", label: "Thème" },
  { value: "libre", label: "Libre" },
];

type FolderWithCount = Folder & { folder_items: { count: number }[] };

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderWithCount[] | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("libre");
  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  const load = async () => {
    const { data } = await supabase
      .from("folders")
      .select("*, folder_items(count)")
      .order("name");
    setFolders((data as FolderWithCount[]) ?? []);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        setMsg("Connecte-toi pour gérer tes dossiers.");
        setFolders([]);
      } else {
        load();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCreating(false);
      return;
    }
    const { error } = await supabase.from("folders").insert({
      owner_id: userData.user.id,
      name,
      category,
    });
    setCreating(false);
    if (error) {
      if (error.message.includes("folders_owner_name_key")) {
        setMsg("Tu as déjà un dossier avec ce nom.");
        return;
      }
      setMsg("Erreur : " + error.message);
    } else {
      setName("");
      setMsg(null);
      load();
    }
  };

  return (
    <ThemeShell>
      <h1 className="mb-6 mt-4 text-2xl font-bold">Mes dossiers</h1>

      <form onSubmit={create} className="mb-8 flex flex-wrap gap-2">
        <input
          required
          placeholder="Nom du dossier (ex : Invader, Louvre...)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-w-48 flex-1 rounded border bg-transparent px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded border bg-transparent px-2 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={creating}
          className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          {creating ? "..." : "Créer"}
        </button>
      </form>

      {msg && <p className="mb-3 text-sm opacity-80">{msg}</p>}
      {folders === null && <p className="opacity-60">Chargement...</p>}
      {folders !== null && folders.length === 0 && !msg && (
        <p className="opacity-70">Aucun dossier. Crée le premier !</p>
      )}

      <ul className="flex flex-col gap-2">
        {(folders ?? []).map((f) => (
          <li key={f.id}>
            <Link
              href={"/folders/" + f.id}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <span className="font-bold">{f.name}</span>
              <span className="text-xs opacity-60">
                {f.category} · {f.folder_items?.[0]?.count ?? 0} œuvre(s)
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </ThemeShell>
  );
}
