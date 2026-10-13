import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNames,
  shuffleArray,
  distributeTeams,
  getTeamSizes,
} from "../team-utils.js";

function withCrypto(crypto, callback) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");

  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: crypto,
  });

  try {
    callback();
  } finally {
    if (original) {
      Object.defineProperty(globalThis, "crypto", original);
    } else {
      delete globalThis.crypto;
    }
  }
}

test("parseNames accepts pasted rows, commas, semicolons and tabs", () => {
  assert.deepEqual(
    parseNames(" 김민지\r\n이 서연, 박지우; 최수빈\t정하린\r오유나 "),
    ["김민지", "이 서연", "박지우", "최수빈", "정하린", "오유나"]
  );
});

test("parseNames keeps duplicate people and removes only empty entries", () => {
  assert.deepEqual(parseNames("\n, 김민지 ; ; 김민지\t \n"), [
    "김민지",
    "김민지",
  ]);
  assert.deepEqual(parseNames("  \r\n,;\t  "), []);
  assert.throws(() => parseNames(null), TypeError);
});

test("shuffleArray makes a copy and uses unbiased crypto rejection sampling", () => {
  const original = ["민지", "서연", "지우"];
  const draws = [0xffffffff, 0, 1];
  let calls = 0;

  withCrypto({
    getRandomValues(buffer) {
      assert.equal(buffer instanceof Uint32Array, true);
      buffer[0] = draws[calls++];
      return buffer;
    },
  }, () => {
    const shuffled = shuffleArray(original);
    assert.deepEqual(shuffled, ["지우", "서연", "민지"]);
    assert.notEqual(shuffled, original);
  });

  assert.equal(calls, 3, "the uneven upper tail is rejected");
  assert.deepEqual(original, ["민지", "서연", "지우"]);
});

test("shuffleArray falls back to Math.random when crypto is unavailable", () => {
  const originalRandom = Math.random;
  const draws = [0, 0];
  let calls = 0;

  try {
    Math.random = () => draws[calls++];

    withCrypto(undefined, () => {
      assert.deepEqual(shuffleArray(["a", "b", "c"]), ["b", "c", "a"]);
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(calls, 2);
});

test("shuffleArray supports empty and one-item arrays without a random draw", () => {
  withCrypto({
    getRandomValues() {
      throw new Error("No draw should be needed");
    },
  }, () => {
    assert.deepEqual(shuffleArray([]), []);
    assert.deepEqual(shuffleArray(["하린"]), ["하린"]);
  });
  assert.throws(() => shuffleArray("민지"), TypeError);
});

test("team sizes are balanced, nonempty and sum to every participant count", () => {
  for (let count = 1; count <= 200; count += 1) {
    for (let teamCount = 1; teamCount <= count; teamCount += 1) {
      const sizes = getTeamSizes(count, teamCount);
      assert.equal(sizes.length, teamCount);
      assert.equal(sizes.reduce((sum, size) => sum + size, 0), count);
      assert.ok(sizes.every((size) => size > 0));
      assert.ok(sizes[0] - sizes.at(-1) <= 1);
      assert.ok(sizes.every((size, index) => index === 0 || sizes[index - 1] >= size));
    }
  }

  assert.deepEqual(getTeamSizes(11, 4), [3, 3, 3, 2]);
});

test("team sizes reject impossible or noninteger counts", () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, "3"]) {
    assert.throws(() => getTeamSizes(count, 1), RangeError);
  }
  for (const teamCount of [0, -1, 1.5, NaN, Infinity, "2", 4]) {
    assert.throws(() => getTeamSizes(3, teamCount), RangeError);
  }
});

test("distribution assigns each participant exactly once across all valid team counts", () => {
  for (const count of [2, 3, 5, 7, 12, 31, 200]) {
    const names = Array.from({ length: count }, (_, index) => `참가자 ${index + 1}`);
    const original = [...names];

    for (let teamCount = 2; teamCount <= count; teamCount += 1) {
      const teams = distributeTeams(names, teamCount);
      assert.deepEqual(teams.map((team) => team.length), getTeamSizes(count, teamCount));
      assert.deepEqual(teams.flat().sort(), [...names].sort());
      assert.deepEqual(names, original);
    }
  }
});

test("distribution keeps identical names as distinct participant entries", () => {
  const names = ["민지", "민지", "서연", "서연", "서연", "지우", "하린"];
  const teams = distributeTeams(names, 3);
  assert.deepEqual(teams.map((team) => team.length), [3, 2, 2]);
  assert.deepEqual(teams.flat().sort(), [...names].sort());
  assert.equal(teams.flat().filter((name) => name === "민지").length, 2);
  assert.equal(teams.flat().filter((name) => name === "서연").length, 3);
});

test("distribution rejects invalid input, team counts and over 200 participants", () => {
  assert.throws(() => distributeTeams(null, 2), TypeError);
  for (const names of [[], ["민지"], Array(201).fill("민지")]) {
    assert.throws(() => distributeTeams(names, 2), RangeError);
  }
  for (const names of [["민지", ""], ["민지", "   "], ["민지", 7]]) {
    assert.throws(() => distributeTeams(names, 2), TypeError);
  }
  for (const teamCount of [0, 1, -1, 1.5, NaN, Infinity, "2", 4]) {
    assert.throws(() => distributeTeams(["민지", "서연", "지우"], teamCount), RangeError);
  }
});
