import {
  Group,
  Panel,
  Separator,
  type PanelImperativeHandle,
} from "react-resizable-panels"

// Direct re-exports without wrapper complications
const ResizablePanelGroup = Group as any
const ResizablePanel = Panel as any
const ResizablePanelResizeHandle = Separator as any

export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizablePanelResizeHandle,
  type PanelImperativeHandle,
}
