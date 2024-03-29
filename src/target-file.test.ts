import { describe, expect, test } from "vitest";
import {
  Dockerfile,
  GitHubActions,
  Nvm,
  type TargetFileType,
  getTargetFileType,
} from "./target-file";

describe(Nvm.type, () => {
  test(Nvm.getNodeVersions.name, () => {
    // arrange
    const content = `
20

`;
    // act
    const versions = Nvm.getNodeVersions(content);
    // assert
    expect(versions).toStrictEqual(["20"]);
  });

  test(Nvm.updateNode.name, () => {
    // arrange
    const content = `
20

`;
    // act
    const newContent = Nvm.updateNode(content, "22");
    // assert
    expect(newContent).toStrictEqual(`
22

`);
  });
});

describe(GitHubActions.type, () => {
  test(GitHubActions.getNodeVersions.name, () => {
    // arrange
    const content = `
        uses: actions/setup-node
        with:
          node-version: "20.x"
    `;
    // act
    const versions = GitHubActions.getNodeVersions(content);
    // assert
    expect(versions).toStrictEqual(["20"]);
  });

  test(GitHubActions.updateNode.name, () => {
    // arrange
    const content = `
        uses: actions/setup-node
        with:
          node-version: "20.x"
    `;
    // act
    const newContent = GitHubActions.updateNode(content, "22");
    // assert
    expect(newContent).toStrictEqual(`
        uses: actions/setup-node
        with:
          node-version: "22.x"
    `);
  });
});

describe(Dockerfile.type, () => {
  test(Dockerfile.getNodeVersions.name, () => {
    // arrange
    const content = `
FROM node:20-bullseye as builder
FROM node:20-bullseye-slim
    `;
    // act
    const versions = Dockerfile.getNodeVersions(content);
    // assert
    expect(versions).toStrictEqual(["20", "20"]);
  });

  test(Dockerfile.updateNode.name, () => {
    // arrange
    const content = `
FROM node:20-bullseye as builder
FROM node:20-bullseye-slim
    `;
    // act
    const newContent = Dockerfile.updateNode(content, "22");
    // assert
    expect(newContent).toStrictEqual(`
FROM node:22-bullseye as builder
FROM node:22-bullseye-slim
    `);
  });

  test(Dockerfile.getDebianVersions.name, () => {
    // arrange
    const content = `
FROM node:20-bullseye as builder
FROM node:20-bullseye-slim
    `;
    // act
    const versions = Dockerfile.getDebianVersions(content);
    // assert
    expect(versions).toStrictEqual(["bullseye", "bullseye"]);
  });

  test(Dockerfile.updateDebian.name, () => {
    // arrange
    const content = `
FROM node:20-bullseye as builder
FROM node:20-bullseye-slim
    `;
    // act
    const newContent = Dockerfile.updateDebian(content, "Bookworm");
    // assert
    expect(newContent).toStrictEqual(`
FROM node:20-bookworm as builder
FROM node:20-bookworm-slim
    `);
  });
});

describe(getTargetFileType.name, () => {
  test("nvm", () => {
    // arrange
    const type: TargetFileType["type"] = "nvm";
    // act
    const result = getTargetFileType(type);
    // assert
    expect(result).toStrictEqual(Nvm);
  });

  test("GitHub Actions", () => {
    // arrange
    const type: TargetFileType["type"] = "GitHub Actions";
    // act
    const result = getTargetFileType(type);
    // assert
    expect(result).toStrictEqual(GitHubActions);
  });

  test("Dockerfile", () => {
    // arrange
    const type: TargetFileType["type"] = "Docker";
    // act
    const result = getTargetFileType(type);
    // assert
    expect(result).toStrictEqual(Dockerfile);
  });
});
