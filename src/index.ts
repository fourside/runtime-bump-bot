import { cli } from "./cli";
import { fetchDebianCycles, fetchNodeCycles } from "./fetch-cycles";
import {
  type FileContentData,
  type TreeObject,
  createBlob,
  createBranch,
  createCommit,
  createPRTitleAndMessage,
  createPullRequest,
  createTree,
  getContents,
  getSha,
  pushCommit,
  searchContents,
} from "./github";
import {
  filterLatestLTSNode,
  filterLivingDebians,
  getOldestDebian,
  isDebianUpdatable,
  isNodeUpdatable,
} from "./is-updatable";
import {
  Dockerfile,
  GitHubActions,
  Nvm,
  type TargetFileType,
  getTargetFileType,
} from "./target-file";

async function main(): Promise<void> {
  const { owner, repo, base: baseBranch, working: workingBranch } = cli();

  const updatedNodeResult = await updateNode(
    owner,
    repo,
    baseBranch,
    workingBranch,
  );
  const updatedDebianResult = await updateDebian(
    owner,
    repo,
    baseBranch,
    workingBranch,
    updatedNodeResult.updated,
  );
  if (updatedNodeResult.updated || updatedDebianResult.updated) {
    const { title, message } = createPRTitleAndMessage(
      updatedNodeResult.version,
      updatedDebianResult.version,
    );
    await createPullRequest({
      owner,
      repo,
      baseBranch,
      headBranch: workingBranch,
      title,
      message,
    });
  }
}

type UpdateResult = {
  updated: boolean;
  version?: string;
};

async function updateNode(
  owner: string,
  repo: string,
  baseBranch: string,
  workingBranch: string,
): Promise<UpdateResult> {
  const nodeCycles = await fetchNodeCycles();
  const latestNode = filterLatestLTSNode(nodeCycles);
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
    return { updated: false };
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

  return {
    updated: true,
    version: latestNode.cycle,
  };
}

async function updateDebian(
  owner: string,
  repo: string,
  baseBranch: string,
  workingBranch: string,
  updated: boolean,
): Promise<UpdateResult> {
  const debianCycles = await fetchDebianCycles();
  const livingDebians = filterLivingDebians(debianCycles);
  const oldestDebian = getOldestDebian(livingDebians);
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
      oldestDebian.codename,
    );
    return {
      content: newContent,
      path: it.path,
    };
  });
  if (updatedContents.length === 0) {
    return { updated: false };
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
  return {
    updated: true,
    version: oldestDebian.codename,
  };
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
    return contents.map((it) => mapFileContentData(targetFile.type, it));
  }
  if (targetFile.type === "Docker") {
    const contents = await searchContents({
      owner,
      repo,
      filename: Dockerfile.path,
      ref,
    });
    return contents.map((it) => mapFileContentData(targetFile.type, it));
  }
  throw new Error(`invalid TargetFile: ${targetFile}`);
}

function mapFileContentData(
  type: TargetFileType["type"],
  data: FileContentData,
): TargetFileContent {
  return {
    type,
    path: data.path,
    content: Buffer.from(data.content, "base64").toString("utf-8"),
  };
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
