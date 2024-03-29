import { cli } from "./cli";
import {
  type DebianCycle,
  type NodeCycle,
  fetchDebianCycles,
  fetchNodeCycles,
} from "./fetch-cycles";
import {
  type TreeObject,
  createBlob,
  createBranch,
  createCommit,
  createTree,
  getContents,
  getSha,
  pushCommit,
  searchContents,
} from "./github";
import {
  Dockerfile,
  GitHubActions,
  Nvm,
  type TargetFileType,
  getTargetFileType,
} from "./target-file";

async function main(): Promise<void> {
  const { owner, repo, base: baseBranch, working: workingBranch } = cli();

  const updated = await updateNode(owner, repo, baseBranch, workingBranch);
  await updateDebian(owner, repo, baseBranch, workingBranch, updated);
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

async function updateNode(
  owner: string,
  repo: string,
  baseBranch: string,
  workingBranch: string,
): Promise<boolean> {
  const latestNode = await fetchLatestNodeLTS();
  const baseSha = await getSha({ owner, repo, branch: baseBranch });

  const targetFileContents = (
    await Promise.all(
      [Nvm, GitHubActions, Dockerfile].map((it) =>
        getTargetFileContents(it, owner, repo, baseSha),
      ),
    )
  ).flat();
  const updatedContents = targetFileContents.flatMap<UpdatedContent>(
    (content) => {
      const targetFile = getTargetFileType(content.type);
      const versions = targetFile.getNodeVersions(content.content);
      if (!isNodeUpdatable(versions, latestNode)) {
        return [];
      }
      const newContent = targetFile.updateNode(
        content.content,
        latestNode.cycle,
      );
      return [{ content: newContent, path: content.path }];
    },
  );

  if (updatedContents.length === 0) {
    return false;
  }

  await createBranch({ owner, repo, branch: workingBranch, sha: baseSha });
  await commitAndPush({
    owner,
    repo,
    branch: workingBranch,
    updatedContents,
    baseSha,
    message: "update node version",
  });

  return true;
}

async function updateDebian(
  owner: string,
  repo: string,
  baseBranch: string,
  workingBranch: string,
  updated: boolean,
): Promise<void> {
  const livingDebians = await fetchLivingDebians();
  const sha = await getSha({
    owner,
    repo,
    branch: updated ? workingBranch : baseBranch,
  });

  const contents = await getTargetFileContents(Dockerfile, owner, repo, sha);
  const updatedContents = contents.flatMap((it) => {
    const versions = Dockerfile.getDebianVersions(it.content);
    if (!isDebianUpdatable(versions, livingDebians)) {
      return [];
    }
    const newContent = Dockerfile.updateDebian(
      it.content,
      livingDebians[livingDebians.length - 1].codename,
    );
    return {
      content: newContent,
      path: it.path,
    };
  });
  if (updatedContents.length === 0) {
    return;
  }

  if (!updated) {
    await createBranch({ owner, repo, branch: workingBranch, sha });
  }
  await commitAndPush({
    owner,
    repo,
    branch: workingBranch,
    updatedContents,
    baseSha: sha,
    message: "update debian version",
  });
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
  livings: DebianCycle[],
): boolean {
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

type UpdatedContent = {
  content: string;
  path: string;
};

type CommitAndPushParams = {
  owner: string;
  repo: string;
  branch: string;
  updatedContents: UpdatedContent[];
  message: string;
  baseSha: string;
};

export async function commitAndPush({
  owner,
  repo,
  updatedContents,
  branch,
  message,
  baseSha,
}: CommitAndPushParams) {
  const tree = await Promise.all(
    updatedContents.map<Promise<TreeObject>>(async (it) => {
      const blobSha = await createBlob({ owner, repo, content: it.content });
      return {
        type: "blob",
        mode: "100644",
        path: it.path,
        sha: blobSha,
      };
    }),
  );
  const treeSha = await createTree({ owner, repo, baseSha, tree });
  const commitSha = await createCommit({
    owner,
    repo,
    message,
    parentSha: baseSha,
    treeSha,
  });
  await pushCommit({ owner, repo, branch, commitSha });
}

(async () => {
  await main();
})();
