import type { DebianCycle, NodeCycle } from "./fetch-cycles";

export function isNodeUpdatable(
  versions: string[],
  latest: NodeCycle,
): boolean {
  if (versions.length === 0) {
    return false;
  }
  const uniqued = Array.from(new Set(versions));
  if (uniqued.length > 1) {
    return true;
  }
  return Number.parseInt(uniqued[0]) < Number.parseInt(latest.cycle);
}

export function isDebianUpdatable(
  versions: string[],
  livings: DebianCycle[],
): boolean {
  if (versions.length === 0) {
    return false;
  }
  const uniqued = Array.from(new Set(versions));
  if (uniqued.length > 1) {
    return true;
  }
  const current = uniqued[0];
  const found = livings.find(
    (it) => it.codename.toLocaleLowerCase() === current.toLocaleLowerCase(),
  );
  return found === undefined;
}

export function filterLatestLTSNode(cycles: NodeCycle[]): NodeCycle {
  const sorted = cycles
    .filter((it) => typeof it.lts !== "boolean")
    .sort((a, b) => (a.lts > b.lts ? -1 : 1));
  return sorted[0];
}

export function filterLivingDebians(cycles: DebianCycle[]): DebianCycle[] {
  const now = new Date();
  return cycles
    .flatMap((it) => {
      if (typeof it.eol === "boolean") {
        return [];
      }
      const eol = new Date(Date.parse(it.eol));
      return eol.getTime() > now.getTime() ? [it] : [];
    })
    .sort((a, b) => Number.parseInt(b.cycle) - Number.parseInt(a.cycle));
}
