"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const { error } =
      tab === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setMsg(error.message);
    } else if (tab === "signup") {
      setMsg(
        "Compte créé ! Si la confirmation par email est activée, vérifie ta boîte mail, puis connecte-toi."
      );
      setTab("signin");
    } else {
      router.push("/collection");
      router.refresh();
    }
  };

  return (
    <ThemeShell>
      <div className="mx-auto mt-10 max-w-sm">
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTab("signin")}
            className="flex-1 rounded-full border px-4 py-2 text-sm"
            style={{ opacity: tab === "signin" ? 1 : 0.5 }}
          >
            Connexion
          </button>
          <button
            onClick={() => setTab("signup")}
            className="flex-1 rounded-full border px-4 py-2 text-sm"
            style={{ opacity: tab === "signup" ? 1 : 0.5 }}
          >
            Inscription
          </button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Mot de passe (6 caractères min)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border bg-transparent px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full border px-4 py-2 font-bold disabled:opacity-50"
          >
            {loading
              ? "..."
              : tab === "signin"
                ? "Se connecter"
                : "Créer le compte"}
          </button>
        </form>
        {msg && <p className="mt-4 text-sm opacity-80">{msg}</p>}
      </div>
    </ThemeShell>
  );
}
