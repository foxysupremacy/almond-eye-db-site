/** Encode every value, including the app's empty-string option, for Radix. */
export function selectWireValue(value: string): string { return `value:${value}`; }
export function selectAppValue(value: string): string { return value.slice("value:".length); }

export interface SelectChoice { value: string; label: string; disabled?: boolean; group?: string }
export function initialSelectIndex(options: readonly SelectChoice[], value: string): number {
  const selected = options.findIndex((option) => option.value === value && !option.disabled);
  return selected >= 0 ? selected : options.findIndex((option) => !option.disabled);
}
export function nextSelectIndex(options: readonly SelectChoice[], current: number, direction: 1 | -1): number {
  for (let step = 1; step <= options.length; step++) {
    const index = (current + direction * step + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

/** Legacy overlay listeners must yield Escape/outside-click to this top layer. */
export function hasOpenAppSelect(): boolean {
  return typeof document !== "undefined" && Boolean(document.querySelector('[data-app-select-layer="true"]'));
}
