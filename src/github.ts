import { Octokit, type RestEndpointMethodTypes } from "@octokit/rest";
import { Env } from "./env";

const octokit = new Octokit({ auth: Env.personalAccessToken });

type GetShaParams = {
  owner: string;
  repo: string;
  branch: string;
};

export async function getSha({
  owner,
  repo,
  branch,
}: GetShaParams): Promise<string> {
  const { data } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  return data.object.sha;
}

type CreateBranchParams = {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
};

export async function createBranch({
  owner,
  repo,
  branch,
  sha,
}: CreateBranchParams): Promise<void> {
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha,
  });
}

type GetContentsParams = {
  owner: string;
  repo: string;
  path: string;
  ref: string;
};

type FileContentData = Extract<
  RestEndpointMethodTypes["repos"]["getContent"]["response"]["data"],
  { type: "file" }
>;

export async function getContents({
  owner,
  repo,
  path,
  ref,
}: GetContentsParams): Promise<FileContentData[]> {
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
    ref,
  });
  if (Array.isArray(data)) {
    const contents = await Promise.all(
      data.flatMap((it) => getContents({ owner, repo, path: it.path, ref })),
    );
    return contents.flat();
  }
  if (data.type !== "file") {
    return [];
  }
  return [data];
}

type SearchContentsParams = {
  owner: string;
  repo: string;
  ref: string;
  filename: string;
};

export async function searchContents({
  owner,
  repo,
  ref,
  filename,
}: SearchContentsParams): Promise<FileContentData[]> {
  const { data } = await octokit.search.code({
    q: `filename:${filename} repo:${owner}/${repo}`,
  });
  const result = await Promise.all(
    data.items.map((it) => getContents({ owner, repo, path: it.path, ref })),
  );
  return result.flat();
}

type CreateBlobParams = {
  owner: string;
  repo: string;
  content: string;
};

export async function createBlob({
  owner,
  repo,
  content,
}: CreateBlobParams): Promise<string> {
  const encoded = Buffer.from(content).toString("base64");
  const { data } = await octokit.git.createBlob({
    owner,
    repo,
    content: encoded,
    encoding: "base64",
  });
  return data.sha;
}

export type TreeObject =
  RestEndpointMethodTypes["git"]["createTree"]["parameters"]["tree"][0];

type CreateTreeParams = {
  owner: string;
  repo: string;
  tree: TreeObject[];
  baseSha: string;
};

export async function createTree({
  owner,
  repo,
  tree,
  baseSha,
}: CreateTreeParams): Promise<string> {
  const { data } = await octokit.git.createTree({
    owner,
    repo,
    tree,
    base_tree: baseSha,
  });
  return data.sha;
}

type CreateCommitParams = {
  owner: string;
  repo: string;
  message: string;
  treeSha: string;
  parentSha: string;
};

export async function createCommit({
  owner,
  repo,
  message,
  treeSha,
  parentSha,
}: CreateCommitParams): Promise<string> {
  const { data } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: treeSha,
    parents: [parentSha],
  });
  return data.sha;
}

type PushCommitParams = {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
};

export async function pushCommit({
  owner,
  repo,
  branch,
  commitSha,
}: PushCommitParams): Promise<void> {
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: commitSha,
  });
}
