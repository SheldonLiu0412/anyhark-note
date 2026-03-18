import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { useUIStore } from '@renderer/stores/ui.store'

export function AppLayout(): React.JSX.Element {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{
          width: sidebarWidth,
          backgroundColor: 'hsl(var(--sidebar-bg))'
        }}
      >
        <Sidebar />
      </aside>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MainContent />
      </main>
    </div>
  )
}
