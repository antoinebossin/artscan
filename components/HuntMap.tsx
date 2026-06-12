"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  photoUrl: string;
  found: boolean;
};

export default function HuntMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const key = JSON.stringify(points);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    let cancelled = false;
    (async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
        await new Promise((r) => setTimeout(r, 150));
      }
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      const map = L.map(ref.current);
      mapRef.current = map;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const bounds = L.latLngBounds(
        points.map((p) => [p.lat, p.lng] as [number, number])
      );
      map.fitBounds(bounds.pad(0.3));
      for (const p of points) {
        const color = p.found ? "#22c55e" : "#e11d48";
        L.circle([p.lat, p.lng], {
          radius: 150,
          color,
          weight: 1,
          fillOpacity: 0.08,
        }).addTo(map);
        L.circleMarker([p.lat, p.lng], {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .bindPopup(
            '<img src="' +
              p.photoUrl +
              '" style="width:130px;border-radius:6px" /><br/><b>' +
              p.label +
              "</b><br/>Zone approximative (150 m)"
          );
      }
      setTimeout(() => map.invalidateSize(), 200);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (points.length === 0) return null;
  return <div ref={ref} className="h-72 w-full rounded-lg border" />;
}
