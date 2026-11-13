// Turns the client's option lists into Twenty select options, so the field and the
// writers share one list of values.
const COLORS = ['blue', 'green', 'orange', 'purple', 'turquoise', 'pink', 'yellow', 'red', 'sky', 'gray'] as const;

export function selectOptions(list: readonly { value: string; label: string }[]) {
  return list.map((option, position) => ({
    value: option.value,
    label: option.label,
    position,
    color: COLORS[position % COLORS.length],
  }));
}
