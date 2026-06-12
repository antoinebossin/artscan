import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AIError, callVisionJSON } from "@/lib/ai";

const PROMPT = `Voici deux photos. La premiere est la photo de REFERENCE d'une oeuvre d'art (street art ou autre). La seconde a ete prise par un participant a une chasse au tresor qui pretend avoir retrouve cette oeuvre.
Les photos peuvent differer par l'angle, la lumiere, la distance, le cadrage, ou une degradation partielle de l'oeuvre.
Question : ces deux photos montrent-elles la MEME oeuvre physique ?
Reponds UNIQUEMENT en JSON strict :
{"same": boolean, "confidence": "high"|"medium"|"low", "note": string}
- "same" : true uniquement si c'est tres probablement la meme oeuvre au meme endroit.
- "note" : une phrase courte en francais expliquant ta decision.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  }

  const body = await req.json();
  const referenceUrl: string | undefined = body.referenceUrl;
  const photoBase64: string | undefined = body.photoBase64;
  if (!referenceUrl || !photoBase64) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }
  if (!referenceUrl.includes(".supabase.co/storage/")) {
    return NextResponse.json(
      { error: "URL de référence invalide" },
      { status: 400 }
    );
  }

  const refRes = await fetch(referenceUrl);
  if (!refRes.ok) {
    return NextResponse.json(
      { error: "Photo de référence inaccessible" },
      { status: 502 }
    );
  }
  const refBase64 = Buffer.from(await refRes.arrayBuffer()).toString("base64");

  try {
    const parsed = await callVisionJSON([refBase64, photoBase64], PROMPT);
    return NextResponse.json(parsed);
  } catch (err) {
    if (err instanceof AIError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Erreur IA" }, { status: 502 });
  }
}
