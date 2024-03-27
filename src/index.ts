import {
  type DebianCycle,
  type NodeCycle,
  fetchDebianCycles,
  fetchNodeCycles,
} from "./fetch-cycles";
import { getContents, getSha, searchContents } from "./github";
import {
  Dockerfile,
  GitHubActions,
  Nvm,
  type TargetFileType,
} from "./target-file";

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

  const targetFileContentsList = await Promise.all(
    [Nvm, GitHubActions, Dockerfile].map((it) =>
      getTargetFileContents(it, owner, repo, baseSha),
    ),
  );
  for (const content of targetFileContentsList.flat()) {
    const getVersions =
      content.type === "nvm"
        ? Nvm.getNodeVersions
        : content.type === "GitHub Actions"
          ? GitHubActions.getNodeVersions
          : Dockerfile.getNodeVersions;
    const versions = getVersions(content.content);
    if (versions.length === 0) {
      continue;
    }
    console.log({ path: content.path, versions });
  }
}

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

type TargetFileContent = {
  type: TargetFileType["type"];
  path: string;
  content: string;
};

async function getTargetFileContents(
  targetFile: TargetFileType,
  owner: string,
  repo: string,
  ref: string,
): Promise<TargetFileContent[]> {
  if (targetFile.type === "nvm" || targetFile.type === "GitHub Actions") {
    const contents = await getContents({
      owner,
      repo,
      path: targetFile.path,
      ref,
    });
    return contents.map((it) => {
      return {
        type: targetFile.type,
        path: it.path,
        content: Buffer.from(it.content, "base64").toString("utf-8"),
      };
    });
  }
  if (targetFile.type === "Docker") {
    const contents = await searchContents({
      owner,
      repo,
      filename: Dockerfile.path,
      ref,
    });
    return contents.map((it) => {
      return {
        type: targetFile.type,
        path: it.path,
        content: Buffer.from(it.content, "base64").toString("utf-8"),
      };
    });
  }
  // TODO: exhaustive
  return [];
}

(async () => {
  await main();
})();
