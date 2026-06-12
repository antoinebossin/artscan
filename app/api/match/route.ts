import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    return NextResponse.json({ error: "URL de référence invalide" }, { status: 400 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY manquante" },
      { status: 500 }
    );
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const refRes = await fetch(referenceUrl);
  if (!refRes.ok) {
    return NextResponse.json(
      { error: "Photo de référence inaccessible" },
      { status: 502 }
    );
  }
  const refBuf = Buffer.from(await refRes.arrayBuffer());
  const refBase64 = refBuf.toString("base64");

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
              { inline_data: { mime_type: "image/jpeg", data: refBase64 } },
              { inline_data: { mime_type: "image/jpeg", data: photoBase64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini match error", res.status, t.slice(0, 300));
    return NextResponse.json(
      { error: "Comparaison indisponible (" + res.status + ")" },
      { status: 502 }
    );
  }

  const json = await res.json();
  const text: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    parsed = null;
  }
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Réponse IA illisible" }, { status: 502 });
  }
  return NextResponse.json(parsed);
}
