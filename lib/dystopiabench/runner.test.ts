
import { expect, test, mock } from "bun:test";

// Mock external dependencies that are missing in the environment
mock.module("@ai-sdk/openai", () => ({
  createOpenAI: () => ({}),
}));
mock.module("ai", () => ({
  generateText: () => ({}),
}));
mock.module("p-limit", () => ({
  default: () => () => ({}),
}));

import { resolveJudgeModels } from "./runner";
import { DEFAULT_JUDGE_MODEL } from "./models";

test("resolveJudgeModels - should return DEFAULT_JUDGE_MODEL when input is undefined and no fallback", () => {
  const result = resolveJudgeModels(undefined);
  expect(result).toEqual([DEFAULT_JUDGE_MODEL]);
});

test("resolveJudgeModels - should return DEFAULT_JUDGE_MODEL when input is empty and no fallback", () => {
  const result = resolveJudgeModels([]);
  expect(result).toEqual([DEFAULT_JUDGE_MODEL]);
});

test("resolveJudgeModels - should return fallbackModel when input is undefined", () => {
  const fallback = "openrouter:gpt-4";
  const result = resolveJudgeModels(undefined, fallback);
  expect(result).toEqual([fallback]);
});

test("resolveJudgeModels - should return input models when provided", () => {
  const input = ["openrouter:gpt-4", "local:claude-3"];
  const result = resolveJudgeModels(input);
  expect(result).toEqual(input);
});

test("resolveJudgeModels - should trim whitespace and filter empty strings", () => {
  const input = [" openrouter:gpt-4 ", " ", ""];
  const result = resolveJudgeModels(input);
  expect(result).toEqual(["openrouter:gpt-4"]);
});

test("resolveJudgeModels - should return DEFAULT_JUDGE_MODEL if all inputs are empty/whitespace", () => {
  const input = [" ", ""];
  const result = resolveJudgeModels(input);
  expect(result).toEqual([DEFAULT_JUDGE_MODEL]);
});

test("resolveJudgeModels - should deduplicate models", () => {
  const input = ["openrouter:gpt-4", " openrouter:gpt-4 ", "local:claude-3"];
  const result = resolveJudgeModels(input);
  expect(result).toEqual(["openrouter:gpt-4", "local:claude-3"]);
});

test("resolveJudgeModels - should throw error for invalid model identifiers", () => {
  const input = ["invalid:"];
  expect(() => resolveJudgeModels(input)).toThrow(/missing model after provider prefix/);
});

test("resolveJudgeModels - should handle local: prefix", () => {
  const input = ["local:llama3"];
  const result = resolveJudgeModels(input);
  expect(result).toEqual(["local:llama3"]);
});

test("resolveJudgeModels - should handle openrouter: prefix", () => {
  const input = ["openrouter:openai/gpt-4o"];
  const result = resolveJudgeModels(input);
  expect(result).toEqual(["openrouter:openai/gpt-4o"]);
});
