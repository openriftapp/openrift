import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSelectionStore } from "@/stores/selection-store";

export function useSearchAndCloseDetail(setSearch: (query: string) => void) {
  const isMobile = useIsMobile();
  return (query: string) => {
    setSearch(query);
    if (isMobile) {
      useSelectionStore.getState().closeDetail();
    }
  };
}
