export class AIError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export async function callVisionJSON(
  imagesBase64: string[],
  prompt: string
): Promise<Record<string, unknown>> {
  const mistralKey = process.env.MISTRAL_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let text = "";

  if (mistralKey) {
    const model = process.env.AI_MODEL || "mistral-small-latest";
    const content: unknown[] = imagesBase64.map((b) => ({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64," + b },
    }));
    content.push({ type: "text", text: prompt });
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + mistralKey,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("Mistral error", res.status, t.slice(0, 300));
      throw new AIError(
        res.status === 429
          ? "Quota IA atteint, réessaie dans une minute."
          : "Erreur IA Mistral (" + res.status + ")"
      );
    }
    const json = await res.json();
    text = json.choices?.[0]?.message?.content ?? "";
  } else if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const parts: unknown[] = imagesBase64.map((b) => ({
      inline_data: { mime_type: "image/jpeg", data: b },
    }));
    parts.push({ text: prompt });
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        model +
        ":generateContent?key=" +
        geminiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.2,
            response_mime_type: "application/json",
          },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.error("Gemini error", res.status, t.slice(0, 300));
      throw new AIError(
        res.status === 429
          ? "Quota IA atteint, réessaie dans une minute."
          : "Erreur IA Gemini (" + res.status + ")"
      );
    }
    const json = await res.json();
    text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else {
    throw new AIError(
      "Détection IA non configurée : ajoute MISTRAL_API_KEY (ou GEMINI_API_KEY) dans les variables d'environnement.",
      500
    );
  }

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (parsed && typeof parsed === "object")
      return parsed as Record<string, unknown>;
  } catch {
    // ignore, AIError ci-dessous
  }
  throw new AIError("Réponse IA illisible, réessaie.");
}
