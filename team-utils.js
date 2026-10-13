const MAX_PARTICIPANTS = 200;
const UINT32_RANGE = 0x100000000;

/** Keep spaces inside a name, and keep separate entries with the same name. */
export function parseNames(input) {
  if (typeof input !== "string") {
    throw new TypeError("이름 목록은 문자열이어야 해요.");
  }

  return input
    .split(/[\r\n,;\t]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function randomInteger(maxExclusive) {
  const crypto = globalThis.crypto;

  if (crypto && typeof crypto.getRandomValues === "function") {
    const sample = new Uint32Array(1);
    // Reject the uneven tail so every possible index has the same probability.
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);

    do {
      crypto.getRandomValues(sample);
    } while (sample[0] >= limit);

    return sample[0] % maxExclusive;
  }

  return Math.floor(Math.random() * maxExclusive);
}

/** Return a Fisher–Yates shuffled copy without changing the original array. */
export function shuffleArray(items) {
  if (!Array.isArray(items)) {
    throw new TypeError("섞을 목록이 필요해요.");
  }

  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/** Larger teams come first; the difference between any two sizes is at most one. */
export function getTeamSizes(participantCount, teamCount) {
  if (!Number.isSafeInteger(participantCount) || participantCount < 1) {
    throw new RangeError("참가자 수는 1명 이상의 정수여야 해요.");
  }

  if (!Number.isSafeInteger(teamCount) || teamCount < 1) {
    throw new RangeError("팀 수는 1 이상의 정수여야 해요.");
  }

  if (teamCount > participantCount) {
    throw new RangeError("팀 수는 참가자 수보다 많을 수 없어요.");
  }

  const baseSize = Math.floor(participantCount / teamCount);
  const extra = participantCount % teamCount;

  return Array.from({ length: teamCount }, (_, index) =>
    baseSize + (index < extra ? 1 : 0)
  );
}

/** Randomly assign every entry once, preserving duplicate names as separate entries. */
export function distributeTeams(names, teamCount) {
  if (!Array.isArray(names)) {
    throw new TypeError("참가자 목록이 필요해요.");
  }

  if (names.length < 2) {
    throw new RangeError("참가자는 2명 이상 입력해 주세요.");
  }

  if (names.length > MAX_PARTICIPANTS) {
    throw new RangeError("참가자는 최대 200명까지 입력할 수 있어요.");
  }

  if (names.some((name) => typeof name !== "string" || !name.trim())) {
    throw new TypeError("참가자 이름은 비어 있지 않은 문자열이어야 해요.");
  }

  if (!Number.isSafeInteger(teamCount) || teamCount < 2) {
    throw new RangeError("팀 수는 2 이상의 정수로 입력해 주세요.");
  }

  const sizes = getTeamSizes(names.length, teamCount);
  const shuffled = shuffleArray(names);
  let offset = 0;

  return sizes.map((size) => {
    const team = shuffled.slice(offset, offset + size);
    offset += size;
    return team;
  });
}
