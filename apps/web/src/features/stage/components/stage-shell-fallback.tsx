/** Dark stand-in while the show's data settles, so no white flash reaches a capture. */
export function StageShellFallback() {
  return <div className="fixed inset-0 z-50 bg-[#08090c]" />;
}
