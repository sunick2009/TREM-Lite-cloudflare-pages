import type { RegionData } from '@web/types/index.ts';

interface TimeTableEntry {
  R: number;
  P: number;
  S: number;
  D?: number;
}

type TimeTable = Record<string, TimeTableEntry[]>;

export class EEWCalculator {
  private timeTable: TimeTable;
  private readonly ln10 = Math.log(10);

  constructor(timeTable?: TimeTable) {
    this.timeTable = timeTable ?? {};
  }

  psWaveDist(depth: number, time: number, now: number): { p_dist: number; s_dist: number; s_t: number } {
    let pDist = 0, sDist = 0, sT = 0;
    const t = (now - time) / 1000.0;

    const keys = Object.keys(this.timeTable).map(Number);
    if (!keys.length) return { p_dist: 0, s_dist: 0, s_t: 0 };

    const depthKey = this.findClosest(keys, depth).toString();
    const timeTableArr = this.timeTable[depthKey];
    let prevTable: TimeTableEntry | null = null;

    for (const table of timeTableArr) {
      if (pDist === 0 && table.P > t) {
        if (prevTable) {
          const tDiff = table.P - prevTable.P;
          const rDiff = table.R - prevTable.R;
          const rOffset = ((t - prevTable.P) / tDiff) * rDiff;
          pDist = prevTable.R + rOffset;
        } else {
          pDist = table.R;
        }
      }
      if (sDist === 0 && table.S > t) {
        if (prevTable) {
          const tDiff = table.S - prevTable.S;
          const rDiff = table.R - prevTable.R;
          const rOffset = ((t - prevTable.S) / tDiff) * rDiff;
          sDist = prevTable.R + rOffset;
        } else {
          sDist = table.R;
          sT = table.S;
        }
      }
      if (pDist !== 0 && sDist !== 0) break;
      prevTable = table;
    }

    return { p_dist: Math.max(0, pDist), s_dist: Math.max(0, sDist), s_t: sT };
  }

  eewAreaPga(
    lat: number,
    lon: number,
    depth: number,
    mag: number,
    region: RegionData,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    let eewMaxI = 0.0;

    for (const city of Object.keys(region)) {
      for (const town of Object.keys(region[city])) {
        const info = region[city][town];
        const distSurface = this.distance(lat, lon, info.lat, info.lon);
        const dist = Math.sqrt(distSurface ** 2 + depth ** 2);
        const pga = 1.657 * Math.exp(1.533 * mag) * Math.pow(dist, -1.607);
        let i = this.pgaToFloat(pga);
        if (i >= 4.5) i = this.eewAreaPgvCalc([lat, lon], [info.lat, info.lon], depth, mag);
        i = this.siteEffect(i, info.site ?? 1.0);
        const intI = this.intensityFloatToInt(i);
        if (intI > 0) {
          result[String(info.code)] = intI;
          if (intI > eewMaxI) eewMaxI = intI;
        }
      }
    }
    return result;
  }

  private eewAreaPgvCalc(
    epicenter: [number, number],
    target: [number, number],
    depth: number,
    mag: number,
  ): number {
    const distSurface = this.distance(epicenter[0], epicenter[1], target[0], target[1]);
    const dist = Math.sqrt(distSurface ** 2 + depth ** 2);
    const pgv600 = Math.pow(10, 0.58 * mag + 0.0038 * depth - 1.29 - Math.log10(dist + 0.0028 * Math.pow(10, 0.5 * mag)) - 0.002 * dist);
    const pgv = pgv600 * 1.31;
    return this.pgvToFloat(pgv);
  }

  pgaToIntensity(pga: number): number {
    return this.intensityFloatToInt(this.pgaToFloat(pga));
  }

  pgaToFloat(pga: number): number {
    if (pga < 0.008) return 0;
    if (pga < 0.025) return 1;
    if (pga < 0.08) return 2;
    if (pga < 0.25) return 3;
    if (pga < 0.80) return 4;
    if (pga < 1.40) return 4.5;
    if (pga < 2.50) return 5;
    if (pga < 4.40) return 5.5;
    if (pga < 8.00) return 6;
    if (pga < 14.0) return 6.5;
    return 7;
  }

  pgvToFloat(pgv: number): number {
    if (pgv < 0.002) return 0;
    if (pgv < 0.007) return 1;
    if (pgv < 0.019) return 2;
    if (pgv < 0.057) return 3;
    if (pgv < 0.15) return 4;
    if (pgv < 0.3) return 4.5;
    if (pgv < 0.6) return 5;
    if (pgv < 1.2) return 5.5;
    if (pgv < 2.1) return 6;
    if (pgv < 4.0) return 6.5;
    return 7;
  }

  siteEffect(i: number, vs30: number): number {
    return i + Math.log10(760 / vs30) * 1.5;
  }

  intensityFloatToInt(float: number): number {
    if (float < 0) return 0;
    if (float < 4.5) return Math.round(float);
    if (float < 5) return 5;
    if (float < 5.5) return 6;
    if (float < 6) return 7;
    if (float < 6.5) return 8;
    return 9;
  }

  private findClosest(arr: number[], target: number): number {
    return arr.reduce((prev, curr) =>
      Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
    );
  }

  distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371.008;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
