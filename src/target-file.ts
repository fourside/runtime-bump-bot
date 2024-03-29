type NvmType = {
  type: "nvm";
  path: ".nvmrc";
  getNodeVersions: (content: string) => string[];
  updateNode: (content: string, newVersion: string) => string;
};

type GitHubActionsType = {
  type: "GitHub Actions";
  path: ".github/workflows";
  getNodeVersions: (content: string) => string[];
  updateNode: (content: string, newVersion: string) => string;
};

type DockerType = {
  type: "Docker";
  path: "Dockerfile";
  getNodeVersions: (content: string) => string[];
  getDebianVersions: (content: string) => string[];
  updateNode: (content: string, newVersion: string) => string;
  updateDebian: (content: string, newVersion: string) => string;
};

export type TargetFileType = NvmType | GitHubActionsType | DockerType;

export const Nvm: NvmType = {
  type: "nvm",
  path: ".nvmrc",
  getNodeVersions: (content) => {
    return [content.trim()];
  },
  updateNode: (content, newVersion) => {
    return content.replace(/^.+$/m, newVersion);
  },
};

export const GitHubActions: GitHubActionsType = {
  type: "GitHub Actions",
  path: ".github/workflows",
  getNodeVersions: (content) => {
    const result = [...content.matchAll(/node-version: "(.+).x"/g)];
    if (result.length === 0) {
      return [];
    }
    return result.map((it) => it[1]);
  },
  updateNode: (content, newVersion) => {
    return content.replace(
      /node-version: ".+"/g,
      `node-version: "${newVersion}.x"`,
    );
  },
};

export const Dockerfile: DockerType = {
  type: "Docker",
  path: "Dockerfile",
  getNodeVersions: (content) => {
    const result = [...content.matchAll(/FROM node:(.+?)-/gi)];
    if (result.length === 0) {
      return [];
    }
    return result.map((it) => it[1]);
  },
  updateNode: (content, newVersion) => {
    return content.replace(/(?<=FROM node:).+?-/g, `${newVersion}-`);
  },
  getDebianVersions: (content) => {
    const result = [...content.matchAll(/FROM .+?-(.+?)[- ]/gi)];
    if (result.length === 0) {
      return [];
    }
    return result.map((it) => it[1]);
  },
  updateDebian: (content, newVersion) => {
    return content.replace(
      /(?<=FROM .+?-).+?(?=[- ])/gi,
      `${newVersion.toLocaleLowerCase()}`,
    );
  },
};

export function getTargetFileType(
  type: TargetFileType["type"],
): TargetFileType {
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
