export function toggleInOrder<T>(order: readonly T[], value: T): T[] {
  return order.includes(value) ? order.filter((entry) => entry !== value) : [...order, value];
}

export function moveInOrder<T>(order: readonly T[], value: T, direction: -1 | 1): T[] {
  const index = order.indexOf(value);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= order.length) {
    return [...order];
  }
  const next = [...order];
  next.splice(index, 1);
  next.splice(target, 0, value);
  return next;
}
