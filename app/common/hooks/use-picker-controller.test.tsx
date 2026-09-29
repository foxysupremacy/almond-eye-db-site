import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { usePickerController, type PickerAdapter } from "./use-picker-controller";

type Input = { label: string };
type State = { query: string };
type Action = { type: "query"; value: string };
type View = { result: string };

const adapter: PickerAdapter<Input, State, Action, View> = {
  initialState: () => ({ query: "" }),
  reduce: (state, action) => action.type === "query" ? { ...state, query: action.value } : state,
  derive: (input, state) => ({ result: `${input.label}:${state.query}` }),
};

function Probe({ input }: { input: Input }) {
  const { state, view } = usePickerController(adapter, input);
  return createElement("output", null, `${state.query}|${view.result}`);
}

describe("usePickerController", () => {
  test("initializes state once and derives the view from current input", () => {
    expect(renderToStaticMarkup(createElement(Probe, { input: { label: "cards" } })))
      .toContain("|cards:");
  });
});
