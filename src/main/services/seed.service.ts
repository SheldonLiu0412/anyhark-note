import type { TipTapDocument, TipTapNode, CreateMemoRequest } from '@shared/types'
import path from 'path'
import fs from 'fs/promises'
import { ulid } from 'ulid'
import * as memoService from './memo.service'
import { readJSON, writeJSON } from './storage.service'
import { getMemosDir, getImagesDir } from '../utils/paths'

function getSeedImagesDir(): string {
  return path.join(process.resourcesPath, 'seed-images')
}

function text(t: string): TipTapNode {
  return { type: 'text', text: t }
}

function tag(p: string): TipTapNode {
  return { type: 'tag', attrs: { path: p, label: `#${p}` } }
}

function mentionLink(url: string, label: string): TipTapNode {
  return {
    type: 'text',
    text: `🔗 ${label}`,
    marks: [{ type: 'mention-link', attrs: { url } }]
  }
}

function mentionNote(memoId: string, label: string): TipTapNode {
  return {
    type: 'text',
    text: label,
    marks: [{ type: 'mention-note', attrs: { memoId } }]
  }
}

function paragraph(...content: TipTapNode[]) {
  return { type: 'paragraph' as const, content }
}

function doc(...paragraphs: ReturnType<typeof paragraph>[]): TipTapDocument {
  return { type: 'doc', content: paragraphs }
}

function extractPlain(content: TipTapDocument): string {
  const parts: string[] = []
  for (const node of content.content) {
    if (node.content) {
      for (const child of node.content) {
        if (child.text) parts.push(child.text)
        else if (child.type === 'tag' && child.attrs?.label) parts.push(String(child.attrs.label))
      }
    }
  }
  return parts.join(' ').trim()
}

async function copyImageToApp(srcPath: string): Promise<string> {
  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const ext = path.extname(srcPath).slice(1).toLowerCase() || 'jpg'
  const filename = `img_${ulid()}.${ext}`
  const dir = path.join(getImagesDir(), year, month)
  await fs.mkdir(dir, { recursive: true })
  await fs.copyFile(srcPath, path.join(dir, filename))
  return filename
}

export async function seedExampleMemos(): Promise<void> {
  if (memoService.listMemoMeta().length > 0) return

  // Note 1 (oldest / bottom) — welcome + import guide
  const note1 = await seed(
    doc(
      paragraph(text('欢迎来到 Anyhark！一款帮你随时捕捉灵感的轻量笔记工具 ✨')),
      paragraph(
        text('输入 '),
        tag('入门/欢迎'),
        text(' 即可创建标签，用 / 实现多级分类。左侧面板会自动构建标签树，方便你快速筛选。')
      ),
      paragraph(
        text('如果你之前在其他 APP 已有笔记，可以点击左下角 ⚙️ 设置，选择「导入笔记」一键迁移（目前支持 Flomo APP 和苹果备忘录）。')
      )
    ),
    ['入门/欢迎'],
    [],
    10
  )

  // Note 2 — tag hierarchy demo
  await seed(
    doc(
      paragraph(tag('入门/标签'), text(' 标签支持层级分类，比如：')),
      paragraph(tag('学习/编程'), text(' '), tag('学习/阅读'), text(' '), tag('生活/灵感')),
      paragraph(text('它们会在左侧自动归组 —— 「学习」下有「编程」和「阅读」两个子标签，一目了然。'))
    ),
    ['入门/标签', '学习/编程', '学习/阅读', '生活/灵感'],
    [],
    9
  )

  // Note 3 — movie diary
  await seed(
    doc(
      paragraph(
        tag('观影日记/《不能说的秘密》'),
        text(' 叶湘伦和路小雨，YXL & LXY')
      ),
      paragraph(text('时间从来不会替你说出口的秘密，但旋律可以。最后那段四手联弹真的绝了。'))
    ),
    ['观影日记/《不能说的秘密》'],
    [],
    8
  )

  // Note 4 — life inspiration
  await seed(
    doc(
      paragraph(tag('生活/随想'), text(' 今天路过天桥，风刚好把围巾吹起来')),
      paragraph(text('突然觉得生活里那些「刚好」的瞬间最值得被记住。'))
    ),
    ['生活/随想'],
    [],
    7
  )

  // Note 5 — logo design with images (bundled in app resources)
  const logoImageSrcDir = getSeedImagesDir()
  const imageFiles = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', 'tone01.jpg', 'tone02.jpg', 'tone03.jpg', 'tone03.jpg']
  const imageFilenames: string[] = []
  for (const file of imageFiles) {
    try {
      const srcPath = path.join(logoImageSrcDir, file)
      await fs.access(srcPath)
      const filename = await copyImageToApp(srcPath)
      imageFilenames.push(filename)
    } catch {
      // skip missing files
    }
  }

  if (imageFilenames.length > 0) {
    await seed(
      doc(
        paragraph(tag('设计/公众号'), text(' 记录我的公众号 Logo 设计稿')),
        paragraph(text('从初版草图到最终定稿的色调选择，过程比想象中纠结。最后选了 02 的配色，安静但有辨识度。'))
      ),
      ['设计/公众号'],
      imageFilenames,
      6
    )
  }

  // Note 6 — link demo
  await seed(
    doc(
      paragraph(tag('入门/网址'), text(' 可以用 @ 给笔记添加链接')),
      paragraph(
        text('在编辑笔记时输入 @，选择「插入网址」，填写链接和显示名称即可。')
      ),
      paragraph(
        text('比如 '),
        mentionLink('https://snailsshell.com', '碎蜗牛壳的个人网页'),
        text(' ← 点击即可复制链接到剪贴板。')
      )
    ),
    ['入门/网址'],
    [],
    4
  )

  // Note 7 — keyboard shortcut
  await seed(
    doc(
      paragraph(tag('入门/搜索'), text(' 按下 ⌘K 可以快速搜索笔记')),
      paragraph(text('在任何界面按 ⌘K（Mac）即可打开搜索框，输入关键词即可定位笔记。再按一次 ⌘K 或 ESC 关闭。'))
    ),
    ['入门/搜索'],
    [],
    3
  )

  // Note 8 — Openclaw AI Agent
  await seed(
    doc(
      paragraph(tag('入门/Openclaw'), text(' 让 AI Agent 帮你操作笔记 🦞')),
      paragraph(
        text('点击左侧的 Openclaw 🦞 按钮，复制 Prompt 发给你的 AI Agent，它就能学会读写你的 Anyhark 笔记了。')
      ),
      paragraph(text('支持 Cursor、Codex、Claude Code、Openclaw 等本地 AI 工具。'))
    ),
    ['入门/Openclaw'],
    [],
    2
  )

  // Note 9 (newest / top) — @Note jump targeting note1 (bottom)
  await seed(
    doc(
      paragraph(tag('入门/引用'), text(' 输入 @ 可以引用其他笔记')),
      paragraph(
        text('在编辑笔记时输入 @，会弹出笔记列表供你检索选择。选中后会生成引用标签，点击即可跳转。')
      ),
      paragraph(
        text('试试点击 '),
        mentionNote(note1.id, '@Note-入门/欢迎-欢迎来到Anyhark'),
        text(' ，会跳转到欢迎笔记 ↓')
      ),
      paragraph(text('开始记录属于你的第一条笔记吧！'))
    ),
    ['入门/引用'],
    [],
    1
  )
}

async function seed(
  content: TipTapDocument,
  tags: string[],
  imageFilenames: string[],
  minutesAgo: number
): Promise<{ id: string }> {
  const created = new Date(Date.now() - minutesAgo * 60000).toISOString()

  const imageNodes: TipTapNode[] = imageFilenames.map((f) => ({
    type: 'image',
    attrs: { src: `anyhark-image://${f}` }
  }))

  const fullContent: TipTapDocument = imageNodes.length > 0
    ? { type: 'doc', content: [...content.content, ...imageNodes] }
    : content

  const req: CreateMemoRequest = {
    content: fullContent,
    plainText: extractPlain(content),
    tags,
    images: imageFilenames
  }

  const memo = await memoService.createMemo(req)

  const filePath = path.join(getMemosDir(), `${memo.id}.json`)
  const full = await readJSON<Record<string, unknown>>(filePath)
  full.createdAt = created
  full.updatedAt = created
  await writeJSON(filePath, full)

  return { id: memo.id }
}
