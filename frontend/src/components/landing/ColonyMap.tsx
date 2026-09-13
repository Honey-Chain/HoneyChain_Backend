// src/components/landing/ColonyMap.tsx
"use client";

import dynamic from "next/dynamic";
import { IconBuildingCommunity, IconBox, IconUsers, IconMapPin } from "@tabler/icons-react";
import ScrollReveal from "@/components/ui/ScrollReveal";
import FlightBeeDecor from "@/components/landing/FlightBeeDecor";
import { BeeIcon } from "@/components/ui/BeeIcon";
import { MAP_NATIONAL_METRICS } from "@/data/indiaBeekeepingData";

// Dynamically import Leaflet map component to prevent SSR 'window is not defined' errors
const ColonyMapInner = dynamic(() => import("./ColonyMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-paper/30 dark:bg-paper-dark/30">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-honey border-t-transparent" />
        <p className="font-mono text-xs text-ink/60 dark:text-ink-dark/60">
          Initializing interactive colony map…
        </p>
      </div>
    </div>
  ),
});

export default function ColonyMap() {
  const metrics = [
    {
      label: "Active Colonies",
      value: "1.44M+",
      subtitle: `${MAP_NATIONAL_METRICS.totalColonies.toLocaleString()} recorded on registry`,
      icon: IconBox,
    },
    {
      label: "Registered Beekeepers",
      value: `${MAP_NATIONAL_METRICS.totalKeepers.toLocaleString()}`,
      subtitle: "Verified individual apiary managers",
      icon: IconUsers,
    },
    {
      label: "Commercial Societies",
      value: `${MAP_NATIONAL_METRICS.totalSocieties}`,
      subtitle: "Agricultural honey cooperatives",
      icon: IconBuildingCommunity,
    },
    {
      label: "States & Territories",
      value: `${MAP_NATIONAL_METRICS.statesCount}`,
      subtitle: "Covered across India",
      icon: IconMapPin,
    },
  ];

  return (
    <section id="map" className="relative px-6 md:px-12 py-28 border-t border-ink/10 dark:border-ink-dark/10">
      <FlightBeeDecor side="left" top="6%" />

      <ScrollReveal from="bottom" className="max-w-5xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-honey/30 bg-honey/10 px-3.5 py-1 text-xs font-medium text-honey mb-4">
          <BeeIcon size={16} />
          <span>National Apiary Infrastructure</span>
        </div>

        <h2 className="font-sans font-bold text-3xl md:text-5xl text-ink dark:text-ink-dark">
          India Colony Distribution Map
        </h2>

        <p className="mt-4 text-ink/60 dark:text-ink-dark/60 max-w-2xl mx-auto leading-relaxed">
          Explore state-level beekeeping density, commercial societies, and active colonies across India based on official KVIC and Madhukranti registry records.
        </p>
      </ScrollReveal>

      {/* KPI Stats Bar */}
      <div className="max-w-6xl mx-auto mb-10 grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <ScrollReveal
              key={m.label}
              from={i % 2 === 0 ? "bottom-left" : "bottom-right"}
              className="rounded-2xl border border-ink/10 bg-white/70 p-5 backdrop-blur-md dark:border-ink-dark/10 dark:bg-white/3"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium uppercase tracking-wider text-ink/50 dark:text-ink-dark/50">
                  {m.label}
                </span>
                <div className="rounded-xl bg-honey/10 p-2 text-honey">
                  <Icon size={18} stroke={1.75} />
                </div>
              </div>
              <p className="text-2xl md:text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
                {m.value}
              </p>
              <p className="mt-1 text-xs text-ink/50 dark:text-ink-dark/50 truncate">
                {m.subtitle}
              </p>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Map Card */}
      <div className="max-w-6xl mx-auto">
        <ScrollReveal from="bottom" className="rounded-3xl border border-ink/10 bg-white p-3 shadow-xl dark:border-ink-dark/10 dark:bg-[#120f0c] sm:p-5">
          <div className="relative h-[550px] md:h-[650px] w-full overflow-hidden rounded-2xl border border-ink/5 dark:border-ink-dark/5">
            <ColonyMapInner />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-ink/60 dark:text-ink-dark/60">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-honey animate-pulse" />
              <span>Hover over any state to inspect localized apiary clusters, commercial firms, and active colonies.</span>
            </div>
            <div className="font-mono text-[11px] text-ink/40 dark:text-ink-dark/40">
              Source: Official KVIC & Madhukranti Data
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
