import { useMemo, useReducer } from "react";

/** Pure state and projection contract for a feature-owned picker workflow. */
export interface PickerAdapter<Input, State, Action, ViewModel> {
  initialState(input: Input): State;
  reduce(state: State, action: Action): State;
  derive(input: Input, state: State): ViewModel;
}

/**
 * Keeps picker transitions pure while allowing the current input to derive a
 * fresh view model on every render. Input changes do not silently reset state.
 */
export function usePickerController<Input, State, Action, ViewModel>(
  adapter: PickerAdapter<Input, State, Action, ViewModel>,
  input: Input,
) {
  const [state, dispatch] = useReducer(adapter.reduce, input, adapter.initialState);
  const view = useMemo(() => adapter.derive(input, state), [adapter, input, state]);
  return { state, view, dispatch };
}
