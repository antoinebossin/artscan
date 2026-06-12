import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Détection IA non configurée (GEMINI_API_KEY manquante)" },
      { status: 500 }
    );
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent?key=" +
      key,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: { mime_type: "image/jpeg", data: imageBase64 },
              },
              { text: PROMPTS[mode] },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    const hint =
      res.status === 429
        ? "Quota gratuit Gemini atteint, réessaie dans une minute."
        : "Erreur Gemini (" + res.status + ")";
    console.error("Gemini error", res.status, t.slice(0, 300));
    return NextResponse.json({ error: hint }, { status: 502 });
  }

  const json = await res.json();
  const text: string =
    json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json(
      { error: "Réponse IA illisible, réessaie." },
      { status: 502 }
    );
  }
  return NextResponse.json(parsed);
}
