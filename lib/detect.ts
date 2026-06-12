export type Detection = {
  artist: string | null;
  title: string | null;
  confidence: "high" | "medium" | "low";
  note?: string | null;
};

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = () => reject(new Error("Lecture de l'image impossible"));
    r.readAsDataURL(blob);
  });
}

export async function detectArtwork(
  blob: Blob,
  mode: "street" | "museum"
): Promise<Detection> {
  const imageBase64 = await blobToBase64(blob);
  const res = await fetch("/api/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64, mode }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Détection impossible");
  return json as Detection;
}
