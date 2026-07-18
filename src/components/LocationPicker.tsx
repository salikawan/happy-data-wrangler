import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, LocateFixed, Search } from "lucide-react";
import { getCurrentPosition } from "@/lib/geo";
import { toast } from "sonner";

// Fix default marker icons (Leaflet + bundlers)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

export type PickedLocation = {
  latitude: number;
  longitude: number;
  address: string;
  radius_meters: number;
};

type Props = {
  value: PickedLocation;
  onChange: (v: PickedLocation) => void;
};

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 0);
    const t2 = setTimeout(fix, 200);
    const t3 = setTimeout(fix, 600);
    const ro = new ResizeObserver(fix);
    ro.observe(el);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      ro.disconnect();
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    return j.display_name ?? "";
  } catch { return ""; }
}

async function searchPlace(q: string): Promise<{ lat: number; lng: number; display: string }[]> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
    { headers: { Accept: "application/json" } },
  );
  const j = await r.json();
  return (j as Array<{ lat: string; lon: string; display_name: string }>).map((x) => ({
    lat: Number(x.lat), lng: Number(x.lon), display: x.display_name,
  }));
}

export function LocationPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ lat: number; lng: number; display: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const markerRef = useRef<L.Marker>(null);

  const center = useMemo<[number, number]>(
    () => [value.latitude || 24.8607, value.longitude || 67.0011], // Karachi default
    [value.latitude, value.longitude],
  );

  async function updatePoint(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    onChange({ ...value, latitude: lat, longitude: lng, address });
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const list = await searchPlace(query);
      setResults(list);
      if (list.length === 0) toast.info("No results");
    } catch { toast.error("Search failed"); }
    finally { setSearching(false); }
  }

  async function pickResult(r: { lat: number; lng: number; display: string }) {
    setResults([]);
    onChange({ ...value, latitude: r.lat, longitude: r.lng, address: r.display });
  }

  async function useCurrent() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      await updatePoint(pos.coords.latitude, pos.coords.longitude);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Location failed");
    } finally { setLocating(false); }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search address or place…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button type="submit" variant="outline" disabled={searching}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
        <Button type="button" variant="outline" onClick={useCurrent} disabled={locating}>
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LocateFixed className="h-4 w-4" /> GPS</>}
        </Button>
      </form>

      {results.length > 0 && (
        <div className="rounded-lg border bg-card divide-y max-h-40 overflow-auto">
          {results.map((r, i) => (
            <button type="button" key={i} onClick={() => pickResult(r)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-accent">
              {r.display}
            </button>
          ))}
        </div>
      )}

      <div className="h-[300px] w-full overflow-hidden rounded-xl border">
        <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter lat={center[0]} lng={center[1]} />
          <InvalidateOnMount />
          <ClickHandler onPick={updatePoint} />
          {value.latitude !== 0 && (
            <>
              <Marker
                position={[value.latitude, value.longitude]}
                icon={icon}
                draggable
                ref={markerRef}
                eventHandlers={{
                  dragend: () => {
                    const m = markerRef.current;
                    if (!m) return;
                    const p = m.getLatLng();
                    updatePoint(p.lat, p.lng);
                  },
                }}
              />
              <Circle
                center={[value.latitude, value.longitude]}
                radius={value.radius_meters}
                pathOptions={{ color: "#7c3aed", fillColor: "#7c3aed", fillOpacity: 0.15 }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label>Latitude</Label>
          <Input type="number" step="any" value={value.latitude}
            onChange={(e) => onChange({ ...value, latitude: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" step="any" value={value.longitude}
            onChange={(e) => onChange({ ...value, longitude: Number(e.target.value) })} />
        </div>
        <div>
          <Label>Radius (meters)</Label>
          <Input type="number" min={10} value={value.radius_meters}
            onChange={(e) => onChange({ ...value, radius_meters: Number(e.target.value) })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[100, 250, 500, 1000].map((r) => (
          <button type="button" key={r} onClick={() => onChange({ ...value, radius_meters: r })}
            className={`rounded-full border px-3 py-1 text-xs ${value.radius_meters === r ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}>
            {r >= 1000 ? `${r / 1000}km` : `${r}m`}
          </button>
        ))}
      </div>

      <div>
        <Label>Address</Label>
        <Input value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="Auto-filled from map" />
      </div>
    </div>
  );
}
