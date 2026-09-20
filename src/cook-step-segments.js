export const LONG_STEP_THRESHOLD = 250;
export const TARGET_SEGMENT_MIN = 100;
export const TARGET_SEGMENT_MAX = 250;
const SHORT_SEGMENT_MERGE_LIMIT = 320;

const sentenceSegmenter = typeof Intl?.Segmenter === "function"
  ? new Intl.Segmenter("de", { granularity: "sentence" })
  : null;

function sourceBlocks(text) {
  const blocks = [];
  const boundary = /\r?\n+/g;
  let start = 0;

  for (const match of text.matchAll(boundary)) {
    const end = match.index + match[0].length;
    blocks.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) blocks.push(text.slice(start));
  return blocks.length ? blocks : [text];
}

function hasSafeSentenceBoundary(segment) {
  return /[.!?…]["'”’)]*$/.test(segment.trimEnd());
}

function endsWithContinuingAbbreviation(segment, nextSegment) {
  const previous = segment.trimEnd().toLocaleLowerCase("de-DE");
  const next = nextSegment.trimStart();
  if (/\b(?:ca|circa|bzw|ggf|inkl|exkl|evtl|sog|nr|d\.\s?h|z\.\s?b|u\.\s?a)\.$/.test(previous)) return true;
  return /\b(?:min|sek|std)\.(?:[\])}]*)$/.test(previous) && /^[\d[(|/]/.test(next);
}

function sentenceParts(block) {
  if (!sentenceSegmenter) return [block];
  const detected = [...sentenceSegmenter.segment(block)].map(({ segment }) => segment);
  const parts = [];
  for (const part of detected) {
    if (parts.length && endsWithContinuingAbbreviation(parts.at(-1), part)) {
      parts[parts.length - 1] += part;
    } else {
      parts.push(part);
    }
  }
  if (parts.length < 2 || parts.join("") !== block) return [block];
  if (parts.slice(0, -1).some((part) => !hasSafeSentenceBoundary(part))) return [block];
  return parts;
}

function groupSentences(parts) {
  const groups = [];
  let current = "";

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!current) {
      current = part;
      continue;
    }

    const combinedLength = current.length + part.length;
    const partIsLong = part.trim().length > TARGET_SEGMENT_MAX;
    const anotherPartFollows = index < parts.length - 1;
    if (combinedLength <= TARGET_SEGMENT_MAX || (current.trim().length < TARGET_SEGMENT_MIN && !partIsLong && anotherPartFollows)) {
      current += part;
    } else {
      groups.push(current);
      current = part;
    }
  }

  if (current) groups.push(current);

  for (let index = groups.length - 1; index > 0 && groups.length > 2; index -= 1) {
    if (groups[index].trim().length >= TARGET_SEGMENT_MIN) continue;
    if (groups[index - 1].length + groups[index].length > SHORT_SEGMENT_MERGE_LIMIT) continue;
    groups[index - 1] += groups[index];
    groups.splice(index, 1);
  }
  return groups;
}

function segmentBlock(block) {
  if (block.trim().length <= LONG_STEP_THRESHOLD) return [block];
  const parts = sentenceParts(block);
  if (parts.length < 2) return [block];
  const groups = groupSentences(parts);
  return groups.length > 1 && groups.join("") === block ? groups : [block];
}

export function segmentCookStep(value) {
  const text = typeof value === "string" ? value : "";
  if (!text) return [text];

  const blocks = sourceBlocks(text);
  const segments = blocks.flatMap(segmentBlock);
  return segments.length && segments.join("") === text ? segments : [text];
}
