import {
  type Describe,
  array,
  boolean,
  object,
  optional,
  string,
  union,
  validate,
} from "superstruct";

export type NodeCycle = {
  cycle: string;
  releaseDate: string;
  eol: string | boolean;
  latest: string;
  latestReleaseDate: string;
  link?: string;
  lts: string | boolean;
  support: string | boolean;
};

export type DebianCycle = {
  cycle: string;
  codename: string;
  releaseDate: string;
  eol: string | boolean;
  latest: string;
  latestReleaseDate: string;
  link?: string;
  lts: string | boolean;
  extendedSupport: string;
};

export async function fetchNodeCycles(): Promise<NodeCycle[]> {
  const json = await fetchCycles("https://endoflife.date/api/nodejs.json");
  const [err, cycles] = validate(json, NodeCycleListSchema);
  if (err !== undefined) {
    console.error(err);
    throw new Error(err.message);
  }
  return cycles;
}

export async function fetchDebianCycles(): Promise<DebianCycle[]> {
  const json = await fetchCycles("https://endoflife.date/api/debian.json");
  const [err, cycles] = validate(json, DebianCycleListSchema);
  if (err !== undefined) {
    console.error(err);
    throw new Error(err.message);
  }
  return cycles;
}

async function fetchCycles(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`status is ${res.status}`);
  }
  return await res.json();
}

const NodeCycleListSchema: Describe<NodeCycle[]> = array(
  object({
    cycle: string(),
    releaseDate: string(),
    eol: union([string(), boolean()]),
    latest: string(),
    latestReleaseDate: string(),
    link: optional(string()),
    lts: union([string(), boolean()]),
    support: union([string(), boolean()]),
  }),
);

const DebianCycleListSchema: Describe<DebianCycle[]> = array(
  object({
    cycle: string(),
    codename: string(),
    releaseDate: string(),
    eol: union([string(), boolean()]),
    latest: string(),
    latestReleaseDate: string(),
    link: optional(string()),
    lts: union([string(), boolean()]),
    extendedSupport: string(),
  }),
);
