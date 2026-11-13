export function sleep(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wraps the callback-based setTimeout
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
