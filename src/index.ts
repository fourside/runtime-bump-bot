import {
  type DebianCycle,
  type NodeCycle,
  fetchDebianCycles,
  fetchNodeCycles,
} from "./fetch-cycles";
import { getContents, getSha } from "./github";

async function main(): Promise<void> {
  const owner = "fourside";
  const repo = "podcast-lambda";
  const baseBranch = "main";

  const baseSha = await getSha({ owner, repo, branch: baseBranch });

  const pathAndContents: PathAndContent[] = [];

  for (const path of Object.keys(updater)) {
    const contents = await getContents({ owner, repo, path, ref: baseSha });
    for (const content of contents) {
      pathAndContents.push({
        key: path,
        contentPath: content.path,
        content: Buffer.from(content.content, "base64").toString("utf-8"),
      });
    }
  }

  const [latestNode, livingDebians] = await Promise.all([
    fetchLatestNodeLTS(),
    fetchLivingDebians(),
  ]);
  console.log({ latestNode, livingDebians });

  for (const pathAndContent of pathAndContents) {
    const { getVersion, replace } = updater[pathAndContent.key];
    const version = getVersion(pathAndContent.content);
    console.log({ contentPath: pathAndContent.contentPath, version });
  }
}

type PathString = string;
type Updater = Record<
  PathString,
  {
    getVersion: (content: string) => string | undefined;
    replace: (content: string, newVersion: string) => string;
  }
>;

type PathAndContent = {
  key: keyof Updater;
  contentPath: string;
  content: string;
};

const updater: Updater = {
  ".github/workflows": {
    getVersion: (content) => {
      const result = [...content.matchAll(/node-version: "(.+).x"/g)];
      if (result.length === 0) {
        return undefined;
      }
      return result[0][1];
    },
    replace: (content, newVersion) => {
      return content.replace(
        /node-version: ".+"/g,
        `node-version: "${newVersion}.x"`,
      );
    },
  },
  ".nvmrc": {
    getVersion: (content) => {
      return content.trim();
    },
    replace: (content, newVersion) => {
      return content.replace(/^.+$/, newVersion);
    },
  },
};

async function fetchLatestNodeLTS(): Promise<NodeCycle> {
  const cycles = await fetchNodeCycles();
  const sorted = cycles
    .filter((it) => typeof it.lts !== "boolean")
    .sort((a, b) => (a.lts > b.lts ? -1 : 1));
  return sorted[0];
}

async function fetchLivingDebians(): Promise<DebianCycle[]> {
  const now = new Date();
  const cycles = await fetchDebianCycles();

  return cycles.flatMap((it) => {
    if (typeof it.lts === "boolean") {
      return [];
    }
    const lts = new Date(Date.parse(it.lts));
    return lts.getTime() > now.getTime() ? [it] : [];
  });
}

(async () => {
  await main();
})();
