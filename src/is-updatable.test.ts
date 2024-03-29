import { describe, expect, test } from "vitest";
import type { DebianCycle, NodeCycle } from "./fetch-cycles";
import { isDebianUpdatable, isNodeUpdatable } from "./is-updatable";

describe(isNodeUpdatable.name, () => {
  test("versions is empty, not updatable", () => {
    // arrange
    const versions = [];
    const latest = createNodeCycle();
    // act
    const result = isNodeUpdatable(versions, latest);
    // assert
    expect(result).toBe(false);
  });

  test("versions is not unique, updatable", () => {
    // arrange
    const versions = ["22", "20"];
    const latest = createNodeCycle();
    // act
    const result = isNodeUpdatable(versions, latest);
    // assert
    expect(result).toBe(true);
  });

  test("latest node is newer, updatable", () => {
    // arrange
    const versions = ["18", "18"];
    const latest = createNodeCycle("20");
    // act
    const result = isNodeUpdatable(versions, latest);
    // assert
    expect(result).toBe(true);
  });

  test("latest node is older, not updatable", () => {
    // arrange
    const versions = ["20", "20"];
    const latest = createNodeCycle("18");
    // act
    const result = isNodeUpdatable(versions, latest);
    // assert
    expect(result).toBe(false);
  });
});

describe(isDebianUpdatable.name, () => {
  test("versions is empty, not updatable", () => {
    // arrange
    const versions = [];
    const cycle = createDebianCycle();
    // act
    const result = isDebianUpdatable(versions, [cycle]);
    // assert
    expect(result).toBe(false);
  });

  test("versions is not unique, updatable", () => {
    // arrange
    const versions = ["bullseye", "bookworm"];
    const cycle = createDebianCycle();
    // act
    const result = isDebianUpdatable(versions, [cycle]);
    // assert
    expect(result).toBe(true);
  });
});

function createNodeCycle(cycle?: string): NodeCycle {
  return {
    cycle: cycle ?? "20",
    releaseDate: "2023-04-18",
    lts: "2023-10-24",
    support: "2024-10-22",
    eol: "2026-04-30",
    latest: "20.12.0",
    latestReleaseDate: "2024-03-26",
  };
}

function createDebianCycle(cycle?: string, codename?: string): DebianCycle {
  return {
    cycle: cycle ?? "12",
    codename: codename ?? "Bookworm",
    releaseDate: "2023-06-10",
    eol: "2026-06-10",
    extendedSupport: "2028-06-10",
    link: "https://www.debian.org/News/2023/20230610",
    latest: "12.5",
    latestReleaseDate: "2024-02-10",
    lts: false,
  };
}
