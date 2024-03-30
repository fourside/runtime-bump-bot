import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { DebianCycle, NodeCycle } from "./fetch-cycles";
import {
  filterLatestLTSNode,
  filterLivingDebians,
  getOldestDebian,
  isDebianUpdatable,
  isNodeUpdatable,
} from "./is-updatable";

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
    const livings = [createDebianCycle()];
    // act
    const result = isDebianUpdatable(versions, livings);
    // assert
    expect(result).toBe(false);
  });

  test("versions is not unique, updatable", () => {
    // arrange
    const versions = ["bullseye", "bookworm"];
    const livings = [createDebianCycle()];
    // act
    const result = isDebianUpdatable(versions, livings);
    // assert
    expect(result).toBe(true);
  });

  test("versions is in living debians, not updatable", () => {
    // arrange
    const versions = ["bullseye", "bullseye"];
    const livings = [
      createDebianCycle("12", "Bookworm"),
      createDebianCycle("11", "Bullseye"),
      createDebianCycle("10", "Buster"),
    ];
    // act
    const result = isDebianUpdatable(versions, livings);
    // assert
    expect(result).toBe(false);
  });

  test("versions is NOT in living debians, updatable", () => {
    // arrange
    const versions = ["stretch", "stretch"];
    const livings = [
      createDebianCycle("12", "Bookworm"),
      createDebianCycle("11", "Bullseye"),
      createDebianCycle("10", "Buster"),
    ];
    // act
    const result = isDebianUpdatable(versions, livings);
    // assert
    expect(result).toBe(true);
  });
});

describe(filterLatestLTSNode.name, () => {
  test("filter latest one of LTSs", () => {
    // arrange
    const cycles: NodeCycle[] = [
      { ...createNodeCycle("21"), lts: false },
      { ...createNodeCycle("20"), lts: "2023-10-24" },
      { ...createNodeCycle("19"), lts: false },
      { ...createNodeCycle("18"), lts: "2022-10-25" },
      { ...createNodeCycle("12"), lts: false },
    ];
    // act
    const result = filterLatestLTSNode(cycles);
    // assert
    expect(result.cycle).toBe("20");
  });
});

describe(filterLivingDebians.name, () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("filter living debians", () => {
    // arrange
    vi.setSystemTime(new Date(2024, 6, 30, 0, 0, 0)); // 2024-07-30
    const cycles: DebianCycle[] = [
      { ...createDebianCycle("12", "Bookworm"), eol: "2026-06-10" },
      { ...createDebianCycle("11", "Bullseye"), eol: "2024-07-31" },
      { ...createDebianCycle("10", "Buster"), eol: "2022-09-10" },
      { ...createDebianCycle("7", "Wheezy"), eol: false },
      { ...createDebianCycle("6", "Squeeze"), eol: false },
    ];
    // act
    const result = filterLivingDebians(cycles);
    // assert
    expect(result.map((it) => it.cycle)).toStrictEqual(["12", "11"]);
  });
});

describe(getOldestDebian.name, () => {
  test("get oldest debian", () => {
    // arrange
    const cycles: DebianCycle[] = [
      createDebianCycle("12", "Bookworm"),
      createDebianCycle("11", "Bullseye"),
      createDebianCycle("10", "Buster"),
    ];
    // act
    const result = getOldestDebian(cycles);
    // assert
    expect(result.cycle).toBe("10");
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
