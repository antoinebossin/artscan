import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIError, callVisionJSON } from "@/lib/ai";

const PROMPTS = {
  museum: `Tu es un expert en histoire de l'art. Identifie cette oeuvre de musee.
Reponds UNIQUEMENT en JSON strict :
{"artist": string|null, "title": string|null, "confidence": "high"|"medium"|"low", "note": string}
- "artist" : nom de l'artiste, null si inconnu.
- "title" : titre de l'oeuvre en francais, null si inconnu.
- "note" : une phrase courte en francais (epoque, musee ou mouvement si tu le sais).
Ne devine pas au hasard : si tu n'es pas sur, baisse "confidence" ou mets null.`,
  street: `Tu es un expert en street art. Identifie l'artiste de cette oeuvre de street art a partir de son style (ex : Invader, Banksy, C215, JR, Miss.Tic, Shepard Fairey, Seth, Vhils...).
Reponds UNIQUEMENT en JSON strict :
{"artist": string|null, "title": string|null, "confidence": "high"|"medium"|"low", "note": string}
- "artist" : nom de l'artiste, null si non identifiable.
- "title" : null sauf oeuvre celebre.
- "note" : une phrase courte en francais sur le style ou la technique.
Le street art est souvent anonyme : en cas de doute, mets null plutot que d'inventer.`,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const body = await req.json();
  const imageBase64: string | undefined = body.imageBase64;
  const mode: "street" | "museum" =
    body.mode === "museum" ? "museum" : "street";
  if (!imageBase64) {
    return NextResponse.json({ error: "Image manquante" }, { status: 400 });
  }

  try {
    const parsed = await callVisionJSON([imageBase64], PROMPTS[mode]);
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erreur IA" }, { status: 502 });
  }
}
