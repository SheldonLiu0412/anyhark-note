import { Sidebar } from './Sidebar'
import { NoteListPanel } from './NoteListPanel'
import { NoteDetailPanel } from './NoteDetailPanel'
import { SettingsDetailPanel } from './SettingsDetailPanel'
import { useUIStore } from '@renderer/stores/ui.store'

export function AppLayout(): React.JSX.Element {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth)
  const noteListWidth = useUIStore((s) => s.noteListWidth)
  const currentView = useUIStore((s) => s.currentView)

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
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden bg-background"
        style={{ width: noteListWidth }}
      >
        <NoteListPanel />
      </div>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        {currentView === 'settings' ? <SettingsDetailPanel /> : <NoteDetailPanel />}
      </main>
    </div>
  )
}
