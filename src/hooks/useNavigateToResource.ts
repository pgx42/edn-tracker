import { useNavigate } from "react-router-dom";
import { usePdfStore } from "@/stores/pdf";

export type ResourceType = "pdf" | "item" | "error" | "anki_card" | "excalidraw";

export interface ResourceTarget {
  type: ResourceType;
  id: string;
  /** For PDF: navigate to this page number */
  page?: number;
}

/**
 * Returns a stable callback that navigates to any resource by type + id,
 * opening the relevant page and detail panel.
 *
 * Consumers (e.g. LinkNavigator, BacklinksPanel) call:
 *   navigateTo({ type: "pdf", id: "42", page: 3 })
 */
export function useNavigateToResource() {
  const navigate = useNavigate();
  const { setActivePdf, setCurrentPage } = usePdfStore();

  const navigateTo = (target: ResourceTarget) => {
    switch (target.type) {
      case "pdf": {
        const numericId = parseInt(target.id, 10);
        if (!isNaN(numericId)) {
          setActivePdf(numericId);
        }
        if (target.page !== undefined) {
          setCurrentPage(target.page);
        }
        navigate("/pdfs");
        break;
      }
      case "item": {
        // Items page opens detail via selectedItem state — we pass it via location state
        navigate("/items", { state: { openItemId: parseInt(target.id, 10) } });
        break;
      }
      case "error": {
        navigate("/errors", { state: { openErrorId: parseInt(target.id, 10) } });
        break;
      }
      case "anki_card": {
        // Anki cards currently live under Planning; pass state for the panel
        navigate("/planning", { state: { openCardId: parseInt(target.id, 10) } });
        break;
      }
      case "excalidraw": {
        navigate("/planning", { state: { openDiagramId: target.id } });
        break;
      }
      default:
        break;
    }
  };

  return navigateTo;
}
