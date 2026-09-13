// src/components/landing/ColonyMapInner.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  INDIA_BEEKEEPING_DATA,
  totalColonies,
  getColor,
  StateBeekeepingRecord,
} from "@/data/indiaBeekeepingData";
import { IconLoader2 } from "@tabler/icons-react";

// Fix Leaflet default icon asset paths for Next.js bundlers
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getStateName(feature: GeoJSON.Feature): string {
  const props = feature.properties || {};
  return (
    props.ST_NM ||
    props.st_nm ||
    props.NAME_1 ||
    props.state_name ||
    "Unknown State"
  );
}

function popupRow(label: string, color: string, count: number, colonies: number): string {
  if (count === 0) return "";
  return `
    <div class="popup-row">
      <span class="popup-label">
        <span class="popup-badge" style="background:${color}"></span>
        ${label}
      </span>
      <span class="popup-values">
        <span class="count">${count.toLocaleString()}</span><br/>
        <span class="colonies">${colonies.toLocaleString()} colonies</span>
      </span>
    </div>`;
}

export default function ColonyMapInner() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // 1. Initialize Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: [22.5937, 78.9629],
      zoom: 4.8,
      minZoom: 4,
      maxZoom: 9,
      scrollWheelZoom: false, // Prevents unintended page scroll capture
    });
    mapInstanceRef.current = map;

    // 2. Add Base Map Tiles (OpenStreetMap default - 100% free, NO API key required)
    const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    const tileUrl = cartoKey
      ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?api_key=${cartoKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const attribution = cartoKey
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    L.tileLayer(tileUrl, {
      attribution,
      maxZoom: 19,
      subdomains: cartoKey ? "abcd" : "abc",
    }).addTo(map);

    let geoJsonLayer: L.GeoJSON;

    function styleFeature(feature?: GeoJSON.Feature) {
      if (!feature) return {};
      const stateName = getStateName(feature);
      const stateData = INDIA_BEEKEEPING_DATA[stateName];
      const colonyCount = stateData ? totalColonies(stateData) : 0;

      return {
        fillColor: getColor(colonyCount),
        weight: 1.5,
        opacity: 1,
        color: "#ffffff",
        fillOpacity: 0.78,
      };
    }

    function onEachFeature(feature: GeoJSON.Feature, layer: L.Layer) {
      const stateName = getStateName(feature);
      const stateData: StateBeekeepingRecord | undefined = INDIA_BEEKEEPING_DATA[stateName];

      if (stateData) {
        const total = totalColonies(stateData);
        const segments = [
          { key: "bkCol" as const, color: "#dfb119" },
          { key: "socCol" as const, color: "#4b7b4e" },
          { key: "firmCol" as const, color: "#3a6ea5" },
          { key: "coCol" as const, color: "#b30000" },
        ];

        const barSegments = segments
          .filter((s) => stateData[s.key] > 0)
          .map(
            (s) =>
              `<div style="width:${((stateData[s.key] / total) * 100).toFixed(
                1
              )}%; background:${s.color}"></div>`
          )
          .join("");

        const popupContent = `
          <div class="popup-card">
            <div class="popup-title">${stateName}</div>
            <div class="popup-total">📦 ${total.toLocaleString()} total colonies</div>

            ${popupRow("👨‍🌾 Beekeepers", "#dfb119", stateData.keepers, stateData.bkCol)}
            ${popupRow("🏢 Societies", "#4b7b4e", stateData.societies, stateData.socCol)}
            ${popupRow("💼 Commercial Firms", "#3a6ea5", stateData.firms, stateData.firmCol)}
            ${popupRow("🏭 Companies", "#b30000", stateData.companies, stateData.coCol)}

            <div class="popup-bar-track">${barSegments}</div>
          </div>
        `;
        (layer as L.Path).bindPopup(popupContent, { maxWidth: 300, className: "honeychain-popup" });
      } else {
        (layer as L.Path).bindPopup(
          `<div class="popup-card">
            <div class="popup-title">${stateName}</div>
            <p style="font-size:12px; color:#777; margin:6px 0 0;">No state-level commercial registry data submitted.</p>
          </div>`,
          { maxWidth: 260 }
        );
      }

      layer.on({
        mouseover: (e: L.LeafletMouseEvent) => {
          const target = e.target as L.Path;
          target.setStyle({
            fillOpacity: 0.95,
            weight: 2.5,
            color: "#211a12",
          });
        },
        mouseout: (e: L.LeafletMouseEvent) => {
          if (geoJsonLayer) {
            geoJsonLayer.resetStyle(e.target as L.Path);
          }
        },
        click: (e: L.LeafletMouseEvent) => {
          map.panTo((e.target as L.Polygon).getBounds().getCenter());
        },
      });
    }

    // 3. Load GeoJSON (local cache first, fallback to CDN)
    async function loadGeoJson() {
      try {
        setLoading(true);
        let data: GeoJSON.FeatureCollection | null = null;

        try {
          const res = await fetch("/data/india.geojson");
          if (res.ok) {
            data = await res.json();
          }
        } catch {
          // Fall back to CDN
        }

        if (!data) {
          const cdnRes = await fetch(
            "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data@2884453/geojson/india.geojson"
          );
          if (!cdnRes.ok) throw new Error("Failed to load map boundaries.");
          data = await cdnRes.json();
        }

        if (!mapInstanceRef.current) return;

        geoJsonLayer = L.geoJSON(data, {
          style: styleFeature,
          onEachFeature,
        }).addTo(map);

        setLoading(false);
      } catch (err) {
        console.error("Failed to load India GeoJSON:", err);
        setError("Unable to render map boundaries at this time.");
        setLoading(false);
      }
    }

    loadGeoJson();

    // 4. Add Interactive Legend
    const legend = new L.Control({ position: "bottomright" });
    legend.onAdd = function () {
      const div = L.DomUtil.create("div", "info-legend");
      div.innerHTML = `
        <div class="legend-header">Colony Scaling Tier</div>
        <div class="legend-item"><i style="background:#b30000"></i> High Production (> 150k)</div>
        <div class="legend-item"><i style="background:#e65c00"></i> Medium-High (50k - 150k)</div>
        <div class="legend-item"><i style="background:#dfb119"></i> Transitional (5k - 50k)</div>
        <div class="legend-item"><i style="background:#a3b18a"></i> Base Footprint (< 5k)</div>
      `;
      return div;
    };
    legend.addTo(map);

    // 5. Cleanup on component unmount
    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full honeychain-colony-map">
      <div ref={mapContainerRef} className="h-full w-full z-10" />

      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-paper/60 backdrop-blur-xs dark:bg-paper-dark/60">
          <IconLoader2 size={32} className="animate-spin text-honey mb-2" />
          <p className="text-xs font-mono text-ink/70 dark:text-ink-dark/70">
            Rendering India Colony Map…
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-paper/80 p-4 text-center dark:bg-paper-dark/80">
          <p className="text-sm text-alert">{error}</p>
        </div>
      )}

      <style jsx global>{`
        .honeychain-colony-map .leaflet-container {
          height: 100%;
          width: 100%;
          font-family: var(--font-sans, inherit);
          background-color: #f1f5f9;
        }

        .honeychain-colony-map .info-legend {
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          color: #211a12;
          font-size: 11.5px;
          line-height: 19px;
          backdrop-filter: blur(8px);
        }

        .honeychain-colony-map .legend-header {
          font-weight: 700;
          font-size: 12px;
          margin-bottom: 5px;
          color: #17130e;
          letter-spacing: -0.01em;
        }

        .honeychain-colony-map .legend-item {
          display: flex;
          align-items: center;
          margin-bottom: 2px;
        }

        .honeychain-colony-map .info-legend i {
          width: 14px;
          height: 14px;
          margin-right: 8px;
          border-radius: 3px;
          flex-shrink: 0;
          display: inline-block;
        }

        .honeychain-colony-map .leaflet-popup-content-wrapper {
          border-radius: 16px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
          border: 1px solid rgba(0, 0, 0, 0.08);
          padding: 4px;
          background: #ffffff;
        }

        .honeychain-colony-map .leaflet-popup-content {
          margin: 12px 14px;
          line-height: 1.4;
        }

        .honeychain-colony-map .popup-card {
          font-family: var(--font-sans, inherit);
          min-width: 230px;
        }

        .honeychain-colony-map .popup-title {
          font-size: 15px;
          font-weight: 700;
          color: #17130e;
          margin-bottom: 2px;
        }

        .honeychain-colony-map .popup-total {
          font-size: 12px;
          color: #d69e1f;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .honeychain-colony-map .popup-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 0;
          border-top: 1px solid #f1f5f9;
        }

        .honeychain-colony-map .popup-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #475569;
        }

        .honeychain-colony-map .popup-badge {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .honeychain-colony-map .popup-values {
          text-align: right;
          font-size: 12px;
        }

        .honeychain-colony-map .popup-values .count {
          font-weight: 700;
          color: #1e293b;
        }

        .honeychain-colony-map .popup-values .colonies {
          color: #64748b;
          font-size: 10.5px;
        }

        .honeychain-colony-map .popup-bar-track {
          height: 5px;
          background: #e2e8f0;
          border-radius: 3px;
          margin-top: 8px;
          overflow: hidden;
          display: flex;
        }

        .honeychain-colony-map .popup-bar-track div {
          height: 100%;
        }
      `}</style>
    </div>
  );
}
