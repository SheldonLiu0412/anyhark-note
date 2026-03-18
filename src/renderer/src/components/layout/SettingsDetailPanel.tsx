import { useState, useCallback } from 'react'
import {
  RotateCcw,
  ExternalLink,
  FileSpreadsheet,
  FileJson,
  FileText,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react'
import { useUIStore, type SettingId } from '@renderer/stores/ui.store'
import { useMemoStore } from '@renderer/stores/memo.store'
import { useTagStore } from '@renderer/stores/tag.store'
import { api } from '@renderer/lib/api'
import flomoGuideImg from '@renderer/assets/flomo-import-guide.png'
import logoImg from '@renderer/assets/logo.png'
import type { AppleNotesImportResult } from '@shared/types'

const APPLE_NOTES_AGENT_PROMPT = `请帮我整理 #AppleNotes 下所有笔记的标签，将它们的标签逐条整理为 #AppleNotes/文件夹名称/笔记概括（2～10个字），不改变任何原有内容。`

const OPENCLAW_PROMPT = `请帮我安装 Anyhark 笔记应用的 Agent Skill。

仓库地址：https://github.com/SheldonLiu0412/anyhark-note
Skill 文件路径：skills/anyhark-note/SKILL.md

安装后你就可以通过 CLI 或 HTTP API 帮我操作 Anyhark 笔记了。`

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2.5 right-2.5 p-1.5 rounded-md hover:bg-accent transition-colors"
      title="复制"
    >
      {copied ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Copy size={14} className="text-muted-foreground" />
      )}
    </button>
  )
}

function ImportSetting(): React.JSX.Element {
  const loadMemos = useMemoStore((s) => s.loadMemos)
  const loadTags = useTagStore((s) => s.loadTags)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [appleNotesResult, setAppleNotesResult] = useState<AppleNotesImportResult | null>(null)
  const isMac = navigator.userAgent.includes('Macintosh')

  const handleImportFlomo = useCallback(async () => {
    const dirPath = await api.import.selectDirectory()
    if (!dirPath) return
    setImporting(true)
    setResult(null)
    try {
      const r = await api.import.flomo(dirPath)
      setResult(`已导入 ${r.imported} 条笔记，${r.images} 张图片`)
      await loadMemos()
      await loadTags()
    } catch (err) {
      setResult('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }, [loadMemos, loadTags])

  const handleImportAnyhark = useCallback(async () => {
    const dirPath = await api.import.selectDirectory()
    if (!dirPath) return
    setImporting(true)
    setResult(null)
    try {
      const r = await api.import.anyhark(dirPath)
      setResult(`已导入 ${r.imported} 条笔记，${r.images} 张图片`)
      await loadMemos()
      await loadTags()
    } catch (err) {
      setResult('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }, [loadMemos, loadTags])

  const handleImportAppleNotes = useCallback(async () => {
    setImporting(true)
    setResult(null)
    try {
      const r = await api.import.appleNotes()
      setAppleNotesResult(r)
      await loadMemos()
      await loadTags()
    } catch (err) {
      setResult('导入失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setImporting(false)
    }
  }, [loadMemos, loadTags])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">导入笔记</h3>
        <p className="text-[13px] text-muted-foreground">从其他应用导入已有笔记数据。</p>
      </div>

      {importing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20">
          <RotateCcw size={14} className="animate-spin text-primary" />
          <span className="text-[13px] text-primary">正在导入中...</span>
        </div>
      )}

      {result && (
        <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border/60 text-[13px] text-foreground/80">
          {result}
        </div>
      )}

      {appleNotesResult && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <p className="text-[13px] text-foreground/80">
            已成功导入 <span className="font-semibold">{appleNotesResult.imported}</span> 条笔记
            {appleNotesResult.images > 0 && <>，<span className="font-semibold">{appleNotesResult.images}</span> 张图片</>}。
          </p>
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium text-foreground/70">导入时已做以下处理：</p>
            <ul className="text-[12px] text-muted-foreground leading-relaxed space-y-1 list-disc pl-4">
              {appleNotesResult.hashConverted > 0 && (
                <li>
                  原笔记中的 <span className="font-mono text-foreground/60">#</span> 已转换为{' '}
                  <span className="font-mono text-foreground/60">+</span>（共 {appleNotesResult.hashConverted} 处）
                </li>
              )}
              <li>
                每条笔记已添加{' '}
                <span className="font-mono text-[11px] text-foreground/60">#AppleNotes/文件夹/前5字</span>{' '}
                标签
              </li>
            </ul>
          </div>
          <div className="space-y-1.5 pt-1">
            <p className="text-[12px] text-foreground/70">复制以下内容发送给 AI Agent 整理标签：</p>
            <div className="relative rounded-lg border border-border/60 bg-background p-3">
              <pre className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words pr-8">
                {APPLE_NOTES_AGENT_PROMPT}
              </pre>
              <CopyButton text={APPLE_NOTES_AGENT_PROMPT} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {isMac && (
          <div className="rounded-lg border border-border/60 p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <FileText size={16} className="text-muted-foreground" />
              <span className="text-[13px] font-medium text-foreground">从苹果备忘录导入</span>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
              直接从 macOS 备忘录 App 中读取并导入所有笔记。首次导入时需要授权自动化权限。
            </p>
            <button
              onClick={handleImportAppleNotes}
              disabled={importing}
              className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              开始导入
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <ExternalLink size={16} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">从 Flomo 导入</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-2">
            打开 Flomo 网页版{' '}
            <a href="https://v.flomoapp.com/mine" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              v.flomoapp.com
            </a>
            ，导出数据后解压，选择文件夹导入。
          </p>
          <div className="rounded-lg border border-border/40 overflow-hidden mb-3">
            <img src={flomoGuideImg} alt="Flomo 导入指引" className="w-full" />
          </div>
          <button
            onClick={handleImportFlomo}
            disabled={importing}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            选择文件夹
          </button>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <FileJson size={16} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">从 Anyhark 导入</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            从 Anyhark JSON 导出的备份中恢复。文件夹内应包含 memos 和 images 子目录。
          </p>
          <button
            onClick={handleImportAnyhark}
            disabled={importing}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            选择文件夹
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportSetting(): React.JSX.Element {
  const [result, setResult] = useState<string | null>(null)

  const handleExportCSV = useCallback(async () => {
    try {
      const r = await api.export.csv()
      if (r) setResult(`已导出 ${r.count} 条笔记 (CSV)`)
    } catch (err) {
      setResult('导出失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }, [])

  const handleExportJSON = useCallback(async () => {
    try {
      const r = await api.export.json()
      if (r) setResult(`已导出 ${r.count} 条笔记 (JSON)`)
    } catch (err) {
      setResult('导出失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">导出笔记</h3>
        <p className="text-[13px] text-muted-foreground">将笔记数据导出为文件。</p>
      </div>

      {result && (
        <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border/60 text-[13px] text-foreground/80">
          {result}
        </div>
      )}

      <div className="space-y-3">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <FileSpreadsheet size={16} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">CSV 导出</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            导出为 CSV 表格 + 图片压缩包，适合查看和迁移到其他工具。
          </p>
          <button
            onClick={handleExportCSV}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            导出 CSV
          </button>
        </div>

        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2.5 mb-2">
            <FileJson size={16} className="text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">JSON 导出</span>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed mb-3">
            导出为 Anyhark 原始格式压缩包，完整保留所有内容和图片，可直接导入回 Anyhark。
          </p>
          <button
            onClick={handleExportJSON}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            导出 JSON
          </button>
        </div>
      </div>
    </div>
  )
}

function OpenclawSetting(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1 flex items-center gap-1.5">
          <span>Openclaw</span>
          <span className="text-[16px]">🦞</span>
        </h3>
        <p className="text-[13px] text-muted-foreground">让 AI Agent 学会操作 Anyhark 笔记。</p>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] text-foreground/80 leading-relaxed">
          复制以下内容发送给你的 AI Agent，即可让它学会操作 Anyhark 笔记。
        </p>
        <div className="relative rounded-lg border border-border/60 bg-muted/30 p-4">
          <pre className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap break-words pr-8">
            {OPENCLAW_PROMPT}
          </pre>
          <CopyButton text={OPENCLAW_PROMPT} />
        </div>
      </div>
    </div>
  )
}

function ResetSetting(): React.JSX.Element {
  const loadMemos = useMemoStore((s) => s.loadMemos)
  const loadTags = useTagStore((s) => s.loadTags)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleReset = useCallback(async () => {
    setConfirming(false)
    try {
      await api.memo.clearAll()
      await loadMemos()
      await loadTags()
      setResult('已重置所有数据')
    } catch (err) {
      setResult('重置失败: ' + (err instanceof Error ? err.message : '未知错误'))
    }
  }, [loadMemos, loadTags])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-1">重置数据</h3>
        <p className="text-[13px] text-muted-foreground">清空所有笔记、标签和历史版本。</p>
      </div>

      {result && (
        <div className="px-4 py-3 rounded-lg bg-muted/50 border border-border/60 text-[13px] text-foreground/80">
          {result}
        </div>
      )}

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle size={18} className="text-destructive" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">此操作不可恢复</p>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              将清空所有笔记、标签和历史版本。建议在重置前先导出数据作为备份。
            </p>
            <div className="mt-3 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                开发阶段临时功能 — 后续版本将增加二次验证、数据备份等安全措施。
              </p>
            </div>
          </div>
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[13px] text-destructive font-medium">确认清空所有数据？</span>
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              确认重置
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3.5 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            重置所有数据
          </button>
        )}
      </div>
    </div>
  )
}

function AboutSetting(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <img src={logoImg} alt="Anyhark" className="w-12 h-12 rounded-xl" />
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Anyhark</h3>
          <p className="text-[13px] text-muted-foreground">v0.1.2</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-border/60 p-4 space-y-2">
          <p className="text-[13px] text-foreground/80 leading-relaxed">
            一个面向人类及其 Agent 分身的本地上下文应用，由人类负责 Any ，Agent负责 Hark 
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4 space-y-2">
          <p className="text-[12px] text-muted-foreground">反馈与建议</p>
          <p className="text-[13px] text-foreground/80">
            <a href="mailto:snailsshell0412@gmail.com" className="text-primary hover:underline">
              snailsshell0412@gmail.com
            </a>
          </p>
        </div>

        <div className="rounded-lg border border-border/60 p-4 space-y-2">
          <p className="text-[12px] text-muted-foreground">开源地址</p>
          <p className="text-[13px] text-foreground/80">
            <a href="https://github.com/SheldonLiu0412/anyhark-note" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
              github.com/SheldonLiu0412/anyhark-note
              <ExternalLink size={12} />
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

const SETTING_COMPONENTS: Record<SettingId, React.FC> = {
  import: ImportSetting,
  export: ExportSetting,
  openclaw: OpenclawSetting,
  reset: ResetSetting,
  about: AboutSetting
}

export function SettingsDetailPanel(): React.JSX.Element {
  const selectedSettingId = useUIStore((s) => s.selectedSettingId)
  const SettingComponent = SETTING_COMPONENTS[selectedSettingId]

  return (
    <div className="flex flex-col h-full">
      <header className="h-12 flex-shrink-0 border-b border-border/50 app-drag-region" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <SettingComponent />
        </div>
      </div>
    </div>
  )
}
