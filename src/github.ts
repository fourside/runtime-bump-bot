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

type GetContentParams = {
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
}: GetContentParams): Promise<FileContentData[]> {
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

    console.log("data is array", contents.flat());
    return contents.flat();
  }
  if (data.type !== "file") {
    return [];
  }
  return [data];
}
