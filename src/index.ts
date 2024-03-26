import {
  type DebianCycle,
  type NodeCycle,
  fetchDebianCycles,
  fetchNodeCycles,
} from "./fetch-cycles";
import { getContents, getSha, searchContents } from "./github";

async function main(): Promise<void> {
  const [latestNode, latestDebian] = await Promise.all([
    fetchLatestNodeLTS(),
    fetchLatestDebian(),
  ]);
  // console.log({ latestNode, latestDebian });

  const owner = "fourside";
  const repo = "podcast-lambda";
  const baseBranch = "main";

  const baseSha = await getSha({ owner, repo, branch: baseBranch });

  const nodeContents: NodeContent[] = [];

  for (const path of Object.keys(nodeUpdater)) {
    const contents = await getContents({ owner, repo, path, ref: baseSha });
    for (const content of contents) {
      nodeContents.push({
        key: path,
        contentPath: content.path,
        content: Buffer.from(content.content, "base64").toString("utf-8"),
      });
    }
  }

  for (const content of nodeContents) {
    const { getVersion, replace } = nodeUpdater[content.key];
    const version = getVersion(content.content);
    console.log({ contentPath: content.contentPath, version });
  }

  const dockerfiles = await searchContents({
    owner,
    repo,
    ref: baseSha,
    filename: "Dockerfile",
  });
  const dockerfileContents: DockerfileContent[] = [];
  for (const dockerfile of dockerfiles) {
    dockerfileContents.push({
      path: dockerfile.path,
      content: Buffer.from(dockerfile.content, "base64").toString("utf-8"),
    });
  }
  for (const content of dockerfileContents) {
    const {
      getNodeVersions: getNodeVersion,
      replaceNodeVersion,
      getDevianVersions: getDevianVersion,
      replaceDebianVersion,
    } = dockerfileUpdater;
    const nodeVersion = getNodeVersion(content.content);
    const debianVersion = getDevianVersion(content.content);
    console.log({ nodeVersion, debianVersion });
  }
}

type PathString = string;
type NodeUpdater = Record<
  PathString,
  {
    getVersion: (content: string) => string | undefined;
    replace: (content: string, newVersion: string) => string;
  }
>;

type NodeContent = {
  key: keyof NodeUpdater;
  contentPath: string;
  content: string;
};

const nodeUpdater: NodeUpdater = {
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

type DockerfileUpdater = {
  getNodeVersions: (content: string) => string[];
  replaceNodeVersion: (content: string, newVersion: string) => string;
  getDevianVersions: (content: string) => string[];
  replaceDebianVersion: (content: string, newVersion: string) => string;
};

type DockerfileContent = {
  path: string;
  content: string;
};

const dockerfileUpdater: DockerfileUpdater = {
  getNodeVersions: (content) => {
    const result = [...content.matchAll(/FROM node:(.+?)-/gi)];
    if (result.length === 0) {
      return [];
    }
    return result.map((it) => it[1]);
  },
  replaceNodeVersion: (content, newVersion) => {
    return content.replace(/(?<=FROM node:).+?-/g, `${newVersion}-`);
  },
  getDevianVersions: (content) => {
    const result = [...content.matchAll(/FROM .+?-(.+?)[- ]/gi)];
    if (result.length === 0) {
      return [];
    }
    return result.map((it) => it[1]);
  },
  replaceDebianVersion: (content, newVersion) => {
    return content.replace(/(?<=FROM .+?-).+?-/gi, `${newVersion}-`);
  },
};

async function fetchLatestNodeLTS(): Promise<NodeCycle> {
  const cycles = await fetchNodeCycles();
  const sorted = cycles
    .filter((it) => typeof it.lts !== "boolean")
    .sort((a, b) => (a.lts > b.lts ? -1 : 1));
  return sorted[0];
}

async function fetchLatestDebian(): Promise<DebianCycle> {
  const now = new Date();
  const cycles = await fetchDebianCycles();
  const sorted = cycles
    .flatMap((it) => {
      if (typeof it.eol === "boolean") {
        return [];
      }
      const eol = new Date(Date.parse(it.eol));
      return eol.getTime() > now.getTime() ? [it] : [];
    })
    .sort((a, b) => Number.parseInt(b.cycle) - Number.parseInt(a.cycle));
  return sorted[0];
}

(async () => {
  await main();
})();
