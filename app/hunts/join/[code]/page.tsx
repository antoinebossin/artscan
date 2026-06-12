"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import { createClient } from "@/lib/supabase/client";

export default function JoinHuntPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [msg, setMsg] = useState("Connexion à la course...");
  const supabase = createClient();

  useEffect(() => {
    const run = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMsg(
          "Connecte-toi (ou crée un compte), puis re-clique sur le lien d'invitation."
        );
        return;
      }
      const { data: hunt } = await supabase
        .from("hunts")
        .select("id, name")
        .eq("share_code", params.code.toLowerCase())
        .single();
      if (!hunt) {
        setMsg("Course introuvable ou non publiée.");
        return;
      }
      const { error } = await supabase
        .from("hunt_participants")
        .upsert(
          { hunt_id: hunt.id, user_id: userData.user.id },
          { onConflict: "hunt_id,user_id" }
        );
      if (error) {
        setMsg("Erreur : " + error.message);
      } else {
        router.push("/hunts/" + hunt.id);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  return (
    <ThemeShell force="street">
      <div className="mt-16 text-center">
        <p>{msg}</p>
        <p className="mt-4 text-sm">
          <Link href="/login" className="underline">
            Connexion / Inscription
          </Link>
        </p>
      </div>
    </ThemeShell>
  );
}
