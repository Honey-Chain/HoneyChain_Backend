// src/data/indiaBeekeepingData.ts

export interface StateBeekeepingRecord {
  keepers: number;
  bkCol: number;
  societies: number;
  socCol: number;
  firms: number;
  firmCol: number;
  companies: number;
  coCol: number;
}

// Merged official KVIC / Madhukranti registry data
export const INDIA_BEEKEEPING_DATA: Record<string, StateBeekeepingRecord> = {
  "Andhra Pradesh":     { keepers: 31,   bkCol: 2135,   societies: 1,  socCol: 400,  firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Arunachal Pradesh":  { keepers: 63,   bkCol: 6300,   societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Assam":              { keepers: 123,  bkCol: 2707,   societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Bihar":              { keepers: 807,  bkCol: 148529, societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Chhattisgarh":       { keepers: 1,    bkCol: 220,    societies: 1,  socCol: 500,  firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "NCT of Delhi":       { keepers: 37,   bkCol: 5300,   societies: 2,  socCol: 1080, firms: 2, firmCol: 550,  companies: 4, coCol: 720 },
  "Goa":                { keepers: 1,    bkCol: 50,     societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Gujarat":            { keepers: 78,   bkCol: 11176,  societies: 0,  socCol: 0,    firms: 1, firmCol: 1000, companies: 1, coCol: 1050 },
  "Haryana":            { keepers: 877,  bkCol: 181731, societies: 2,  socCol: 2677, firms: 5, firmCol: 13200,companies: 3, coCol: 2050 },
  "Himachal Pradesh":   { keepers: 356,  bkCol: 53132,  societies: 2,  socCol: 21,   firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Jammu and Kashmir":  { keepers: 221,  bkCol: 21667,  societies: 1,  socCol: 98,   firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Jharkhand":          { keepers: 51,   bkCol: 7320,   societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Karnataka":          { keepers: 651,  bkCol: 10556,  societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Kerala":             { keepers: 14,   bkCol: 6160,   societies: 2,  socCol: 2080, firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Madhya Pradesh":     { keepers: 262,  bkCol: 42978,  societies: 2,  socCol: 764,  firms: 1, firmCol: 500,  companies: 0, coCol: 0 },
  "Maharashtra":        { keepers: 61,   bkCol: 7132,   societies: 1,  socCol: 100,  firms: 0, firmCol: 0,    companies: 1, coCol: 500 },
  "Manipur":            { keepers: 2,    bkCol: 420,    societies: 1,  socCol: 100,  firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Mizoram":            { keepers: 6,    bkCol: 184,    societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Nagaland":           { keepers: 231,  bkCol: 4007,   societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Odisha":             { keepers: 30,   bkCol: 1505,   societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Puducherry":         { keepers: 2,    bkCol: 725,    societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Punjab":             { keepers: 1179, bkCol: 207883, societies: 0,  socCol: 0,    firms: 8, firmCol: 4500, companies: 4, coCol: 60000 },
  "Rajasthan":          { keepers: 551,  bkCol: 110329, societies: 4,  socCol: 3000, firms: 4, firmCol: 2950, companies: 0, coCol: 0 },
  "Tamil Nadu":         { keepers: 9,    bkCol: 970,    societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Tripura":            { keepers: 2,    bkCol: 200,    societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "Uttar Pradesh":      { keepers: 2291, bkCol: 339975, societies: 20, socCol: 11695,firms: 9, firmCol: 8140, companies: 5, coCol: 6650 },
  "Uttarakhand":        { keepers: 442,  bkCol: 73340,  societies: 2,  socCol: 1015, firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
  "West Bengal":        { keepers: 671,  bkCol: 69311,  societies: 0,  socCol: 0,    firms: 0, firmCol: 0,    companies: 0, coCol: 0 },
};

export function totalColonies(d: StateBeekeepingRecord): number {
  return d.bkCol + d.socCol + d.firmCol + d.coCol;
}

export function getColor(d: number): string {
  return d > 150000 ? "#b30000" :
         d > 50000  ? "#e65c00" :
         d > 5000   ? "#dfb119" :
         d > 0      ? "#a3b18a" :
                      "#cbd5e1";
}

export const MAP_NATIONAL_METRICS = (() => {
  let totalKeepers = 0;
  let totalColoniesCount = 0;
  let totalSocieties = 0;
  let totalCommercialEntities = 0;

  for (const key in INDIA_BEEKEEPING_DATA) {
    const item = INDIA_BEEKEEPING_DATA[key];
    totalKeepers += item.keepers;
    totalColoniesCount += totalColonies(item);
    totalSocieties += item.societies;
    totalCommercialEntities += item.firms + item.companies;
  }

  return {
    totalKeepers,
    totalColonies: totalColoniesCount,
    totalSocieties,
    totalCommercialEntities,
    statesCount: Object.keys(INDIA_BEEKEEPING_DATA).length,
  };
})();
