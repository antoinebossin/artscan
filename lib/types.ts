export interface Artwork {
  id: string;
  type: "street" | "museum";
  photo_url: string;
  title: string | null;
  artist_name: string | null;
  location_text: string | null;
  museum_name: string | null;
  notes: string | null;
  lat: number | null;
  lng: number | null;
  scanned_at: string;
}

export interface Folder {
  id: string;
  name: string;
  category: string;
  mode: "street" | "museum";
}
