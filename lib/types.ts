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

export interface Hunt {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  share_code: string;
  is_published: boolean;
  created_at: string;
}

export interface HuntArtwork {
  id: string;
  hunt_id: string;
  artwork_id: string;
  points: number;
  artworks?: Artwork;
}

export interface HuntParticipant {
  id: string;
  hunt_id: string;
  user_id: string;
  joined_at: string;
  profiles?: { username: string };
}

export interface Find {
  id: string;
  participant_id: string;
  hunt_artwork_id: string;
  photo_url: string;
  lat: number | null;
  lng: number | null;
  status: "auto_validated" | "pending" | "rejected" | "approved";
  found_at: string;
}
