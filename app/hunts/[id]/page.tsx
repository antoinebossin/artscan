"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ThemeShell from "@/components/ThemeShell";
import HuntMap, { type MapPoint } from "@/components/HuntMap";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { blobToBase64 } from "@/lib/detect";
import { haversineMeters, jitterCoords } from "@/lib/geo";
import type { Find, Hunt, HuntArtwork, HuntParticipant } from "@/lib/types";

const VALID = new Set(["auto_validated", "approved"]);
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";

export default function HuntDetailPage() {
  const params = useParams<{ id: string }>();
  const [hunt, setHunt] = useState<Hunt | null>(null);
  const [items, setItems] = useState<HuntArtwork[]>([]);
  const [participants, setParticipants] = useState<HuntParticipant[]>([]);
  const [finds, setFinds] = useState<Find[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData.user?.id ?? null);
    const [h, i, p] = await Promise.all([
      supabase.from("hunts").select("*").eq("id", params.id).single(),
      supabase
        .from("hunt_artworks")
        .select("*, artworks(*)")
        .eq("hunt_id", params.id),
      supabase
        .from("hunt_participants")
        .select("*, profiles(username)")
        .eq("hunt_id", params.id),
    ]);
    setHunt(h.data as Hunt | null);
    setItems((i.data as unknown as HuntArtwork[]) ?? []);
    const parts = (p.data as unknown as HuntParticipant[]) ?? [];
    setParticipants(parts);
    if (parts.length > 0) {
      const { data: f } = await supabase
        .from("finds")
        .select("*")
        .in(
          "participant_id",
          parts.map((x) => x.id)
        );
      setFinds((f as Find[]) ?? []);
    } else {
      setFinds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreator = hunt !== null && userId !== null && hunt.creator_id === userId;
  const me = participants.find((p) => p.user_id === userId) ?? null;
  const myFinds = useMemo(
    () => finds.filter((f) => me && f.participant_id === me.id),
    [finds, me]
  );

  const mapPoints: MapPoint[] = useMemo(
    () =>
      items
        .filter((it) => it.artworks?.lat != null && it.artworks?.lng != null)
        .map((it) => {
          const a = it.artworks!;
          const pos = jitterCoords(a.id, a.lat!, a.lng!);
          const found = myFinds.some(
            (f) => f.hunt_artwork_id === it.id && VALID.has(f.status)
          );
          return {
            id: it.id,
            lat: pos.lat,
            lng: pos.lng,
            label: a.title || "Œuvre à trouver",
            photoUrl: a.photo_url,
            found,
          };
        }),
    [items, myFinds]
  );

  const leaderboard = useMemo(() => {
    const pointsByItem = new Map(items.map((it) => [it.id, it.points]));
    return participants
      .map((p) => ({
        name: p.profiles?.username ?? "?",
        isMe: p.user_id === userId,
        score: finds
          .filter((f) => f.participant_id === p.id && VALID.has(f.status))
          .reduce((sum, f) => sum + (pointsByItem.get(f.hunt_artwork_id) ?? 0), 0),
        found: finds.filter(
          (f) => f.participant_id === p.id && VALID.has(f.status)
        ).length,
      }))
      .sort((a, b) => b.score - a.score);
  }, [participants, finds, items, userId]);

  const togglePublish = async () => {
    if (!hunt) return;
    const { error } = await supabase
      .from("hunts")
      .update({ is_published: !hunt.is_published })
      .eq("id", hunt.id);
    if (!error) setHunt({ ...hunt, is_published: !hunt.is_published });
  };

  const share = async () => {
    if (!hunt) return;
    const url = window.location.origin + "/hunts/join/" + hunt.share_code;
    const text = "Rejoins ma course street art \"" + hunt.name + "\" sur ArtScan !";
    if (navigator.share) {
      await navigator.share({ title: "ArtScan", text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setMsg("Lien copié : " + url);
    }
  };

  const join = async () => {
    if (!hunt || !userId) return;
    await supabase
      .from("hunt_participants")
      .upsert(
        { hunt_id: hunt.id, user_id: userId },
        { onConflict: "hunt_id,user_id" }
      );
    load();
  };

  const getPosition = (): Promise<{ lat: number; lng: number } | null> =>
    new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });

  const submitFind = async (item: HuntArtwork, file: File) => {
    if (!me || !userId) return;
    setBusy(item.id);
    setMsg("Analyse de ta photo...");
    try {
      const pos = await getPosition();
      const blob = await compressImage(file);
      const a = item.artworks;

      const gpsKnown = pos !== null && a?.lat != null && a?.lng != null;
      const gpsOk =
        gpsKnown && haversineMeters(pos.lat, pos.lng, a.lat!, a.lng!) <= 150;

      let imageMatch: boolean | null = null;
      let matchNote = "";
      if (AI_ENABLED && a?.photo_url) {
        try {
          const small = await compressImage(file, 1024, 0.8);
          const photoBase64 = await blobToBase64(small);
          const res = await fetch("/api/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceUrl: a.photo_url,
              photoBase64,
            }),
          });
          if (res.ok) {
            const m = (await res.json()) as {
              same: boolean;
              confidence: string;
              note?: string;
            };
            imageMatch = m.same && m.confidence !== "low";
            matchNote = m.note ?? "";
          }
        } catch {
          imageMatch = null;
        }
      }

      const autoOk = AI_ENABLED
        ? imageMatch === true
          ? gpsKnown
            ? gpsOk
            : true
          : imageMatch === null && gpsOk
        : false;

      const path = userId + "/finds/" + crypto.randomUUID() + ".jpg";
      const { error: upErr } = await supabase.storage
        .from("photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
      const { error } = await supabase.from("finds").insert({
        participant_id: me.id,
        hunt_artwork_id: item.id,
        photo_url: pub.publicUrl,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        status: autoOk ? "auto_validated" : "pending",
      });
      if (error) throw error;
      if (autoOk) {
        setMsg(
          "Trouvaille validée ✓ (photo reconnue" +
            (gpsOk ? " + GPS" : "") +
            ") +" +
            item.points +
            " points !"
        );
      } else if (imageMatch === false) {
        setMsg(
          "La photo ne semble pas correspondre à l'œuvre (" +
            matchNote +
            ") — envoyée au créateur pour validation manuelle."
        );
      } else {
        setMsg("Photo envoyée — en attente de validation par le créateur.");
      }
      load();
    } catch (err) {
      setMsg("Erreur : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(null);
    }
  };

  const moderate = async (find: Find, status: "approved" | "rejected") => {
    await supabase.from("finds").update({ status }).eq("id", find.id);
    load();
  };

  const statusLabel: Record<string, string> = {
    auto_validated: "Validée GPS ✓",
    approved: "Validée ✓",
    pending: "En attente",
    rejected: "Refusée",
  };

  const pendingFinds = finds.filter((f) => f.status === "pending");

  if (hunt === null) {
    return (
      <ThemeShell force="street">
        <p className="mt-10 opacity-70">
          Course introuvable, non publiée, ou tu n&apos;es pas connecté.
        </p>
      </ThemeShell>
    );
  }

  return (
    <ThemeShell force="street">
      <p className="mt-4 text-xs opacity-60">
        <Link href="/hunts" className="underline">
          ← Courses
        </Link>
      </p>
      <div className="mb-1 mt-1 flex flex-wrap items-center gap-3">
        <h1
          className="text-2xl font-black uppercase"
          style={{ color: "var(--street-accent)" }}
        >
          {hunt.name}
        </h1>
        <span className="rounded-full border px-2 py-0.5 text-xs opacity-70">
          {hunt.is_published ? "Publiée" : "Brouillon"}
        </span>
      </div>
      {hunt.description && (
        <p className="mb-3 text-sm opacity-80">{hunt.description}</p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {isCreator && (
          <>
            <button
              onClick={togglePublish}
              className="rounded-full border px-4 py-2 text-sm font-bold"
            >
              {hunt.is_published ? "Dépublier" : "Publier la course"}
            </button>
            <button
              onClick={share}
              disabled={!hunt.is_published}
              className="rounded-full border px-4 py-2 text-sm disabled:opacity-40"
            >
              Partager (code : {hunt.share_code})
            </button>
          </>
        )}
        {!isCreator && !me && userId && (
          <button
            onClick={join}
            className="rounded-full border px-4 py-2 text-sm font-bold"
          >
            Rejoindre cette course
          </button>
        )}
      </div>

      {msg && <p className="mb-4 text-sm opacity-90">{msg}</p>}

      <HuntMap points={mapPoints} />

      <h2 className="mb-2 mt-8 text-lg font-bold">
        Œuvres à trouver ({items.length})
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {items.map((it) => {
          const a = it.artworks;
          const myFind = myFinds.find((f) => f.hunt_artwork_id === it.id);
          return (
            <div key={it.id} className="overflow-hidden rounded-lg border">
              {a && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.photo_url}
                  alt="Référence"
                  className="aspect-square w-full object-cover"
                />
              )}
              <div className="flex flex-col gap-1 p-2 text-xs">
                <span className="font-bold">
                  {a?.title || "Œuvre"} · {it.points} pts
                </span>
                {a?.location_text && (
                  <span className="opacity-60">{a.location_text}</span>
                )}
                {myFind && (
                  <span className="font-bold opacity-90">
                    {statusLabel[myFind.status]}
                  </span>
                )}
                {me && !myFind && hunt.is_published && (
                  <label
                    className="mt-1 cursor-pointer self-start rounded-full border px-2 py-1 font-bold"
                    style={{ opacity: busy === it.id ? 0.4 : 1 }}
                  >
                    {busy === it.id ? "Envoi..." : "J'ai trouvé !"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={busy !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) submitFind(it, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isCreator && pendingFinds.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-lg font-bold">
            À valider ({pendingFinds.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pendingFinds.map((f) => {
              const item = items.find((it) => it.id === f.hunt_artwork_id);
              const who = participants.find((p) => p.id === f.participant_id);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item?.artworks?.photo_url ?? ""}
                    alt="Référence"
                    className="h-16 w-16 rounded object-cover"
                  />
                  <span className="opacity-60">vs</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.photo_url}
                    alt="Soumission"
                    className="h-16 w-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-bold">
                      {who?.profiles?.username ?? "?"}
                    </p>
                    <p className="text-xs opacity-60">
                      {item?.artworks?.title || "Œuvre"}
                    </p>
                    <p className="text-xs opacity-60">
                      {f.lat != null &&
                      f.lng != null &&
                      item?.artworks?.lat != null &&
                      item?.artworks?.lng != null
                        ? "GPS : à " +
                          Math.round(
                            haversineMeters(
                              f.lat,
                              f.lng,
                              item.artworks.lat,
                              item.artworks.lng
                            )
                          ) +
                          " m de l'œuvre"
                        : "Pas de position GPS"}
                    </p>
                  </div>
                  <button
                    onClick={() => moderate(f, "approved")}
                    className="rounded-full border px-3 py-1"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => moderate(f, "rejected")}
                    className="rounded-full border px-3 py-1 opacity-60"
                  >
                    Refuser
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2
        className="mb-2 mt-8 text-lg font-black uppercase"
        style={{ color: "var(--street-accent-2)" }}
      >
        Classement
      </h2>
      {leaderboard.length === 0 ? (
        <p className="text-sm opacity-60">Aucun participant pour l&apos;instant.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {leaderboard.map((row, idx) => (
            <li
              key={row.name + idx}
              className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm"
              style={{
                fontWeight: row.isMe ? 700 : 400,
                borderColor: idx === 0 ? "var(--street-accent)" : undefined,
                color: idx === 0 ? "var(--street-accent)" : undefined,
              }}
            >
              <span>
                {idx + 1}. {row.name} {row.isMe ? "(toi)" : ""}
              </span>
              <span>
                {row.found} trouvée(s) · {row.score} pts
              </span>
            </li>
          ))}
        </ol>
      )}
    </ThemeShell>
  );
}
