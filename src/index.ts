import {
  type DebianCycle,
  type NodeCycle,
  fetchDebianCycles,
  fetchNodeCycles,
} from "./fetch-cycles";
import {
  type TreeObject,
  commitAndPush,
  createBlob,
  getContents,
  getSha,
  searchContents,
} from "./github";
import {
  Dockerfile,
  GitHubActions,
  Nvm,
  type TargetFileType,
} from "./target-file";

async function main(): Promise<void> {
  const [latestNode, livingDebians] = await Promise.all([
    fetchLatestNodeLTS(),
    fetchLivingDebians(),
  ]);

  const owner = "fourside";
  const repo = "podcast-lambda";
  const baseBranch = "main";
  const newBranch = "bump";

  const baseSha = await getSha({ owner, repo, branch: baseBranch });

  const targetFileContentsList = await Promise.all(
    [Nvm, GitHubActions, Dockerfile].map((it) =>
      getTargetFileContents(it, owner, repo, baseSha),
    ),
  );
  const nodeTreeObjects: TreeObject[] = [];
  for (const content of targetFileContentsList.flat()) {
    const targetFile = getTargetFileType(content.type);
    const versions = targetFile.getNodeVersions(content.content);
    if (isNodeUpdatable(versions, latestNode)) {
      const newContent = targetFile.updateNode(
        content.content,
        latestNode.cycle,
      );
      const treeObject = await createBlob({
        owner,
        repo,
        content: newContent,
        path: content.path,
      });
      nodeTreeObjects.push(treeObject);
    }
  }

  if (nodeTreeObjects.length > 0) {
    await commitAndPush({
      owner,
      repo,
      branch: newBranch,
      tree: nodeTreeObjects,
      baseSha,
      message: "update node version",
    });
  }
  // debian update
}

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

function getTargetFileType(type: TargetFileType["type"]): TargetFileType {
  switch (type) {
    case "nvm":
      return Nvm;
    case "GitHub Actions":
      return GitHubActions;
    case "Docker":
      return Dockerfile;
    default:
      throw new Error(`invalid type: ${type}`);
  }
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
  throw new Error(`invalid TargetFile: ${targetFile}`);
}

function isNodeUpdatable(versions: string[], latest: NodeCycle): boolean {
  if (versions.length === 0) {
    return false;
  }
  const uniqued = Array.from(new Set(versions));
  if (uniqued.length > 1) {
    return true;
  }
  return Number.parseInt(uniqued[0]) < Number.parseInt(latest.cycle);
}

function isDebianUpdatable(
  versions: string[],
  livings: DebianCycle[], // sorted
): boolean {
  const uniqued = Array.from(new Set(versions));
  if (uniqued.length > 1) {
    return true;
  }
  const current = uniqued[0];
  const found = livings.find(
    (it) => it.codename.toLocaleLowerCase() === current.toLocaleLowerCase(),
  );
  if (found === undefined) {
    return true;
  }
  return Number.parseInt(found.cycle) < Number.parseInt(livings[0].cycle);
}

function assertNerver(x: never) {
  throw new Error(x);
}

(async () => {
  await main();
})();
