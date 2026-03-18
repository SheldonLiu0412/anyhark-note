---
name: anyhark-note
description: >-
  操作 Anyhark 本地笔记应用的数据。用于通过 CLI 或 HTTP API 对笔记进行增删改查、搜索、导出等操作。
  当需要操作 Anyhark 笔记数据时使用此 Skill。
---
# Anyhark Agent Skill

Anyhark 是一个本地卡片笔记 Electron 应用。本文档指导 AI Agent 如何通过 CLI 脚本或 HTTP API 操作 Anyhark 数据。

## 前置条件

- Anyhark 应用必须处于运行状态（`npm run dev` 或已安装的 APP）
- 应用启动后会在 `127.0.0.1:17533` 开启本地 HTTP API 服务
- CLI 脚本位于项目目录 `scripts/anyhark-cli.ts`
- 通过 API 进行的写操作（创建、更新、删除）会实时同步到 APP 界面

## 数据存储位置

**绝对不要直接读写这些文件**，请始终通过 CLI 或 HTTP API 操作。

```
~/Library/Application Support/anyhark/   (macOS)
%APPDATA%/anyhark/                       (Windows)
~/.config/anyhark/                       (Linux)

  data/
    memos/              每条笔记一个 JSON 文件 ({ulid}.json)
    images/             图片文件，按 YYYY/MM/ 子目录组织
    _index/
      metadata.json     元数据索引（由服务层自动维护）
      tags.json         标签索引（由服务层自动维护）
  api-port              当前 API 端口号（APP 运行时生成）
```

## CLI 使用方法

在项目根目录执行：

```bash
npx tsx scripts/anyhark-cli.ts <command> [options]
# 或
npm run cli -- <command> [options]
```

所有命令输出均为 JSON 格式。

### 命令参考

| 命令 | 用法 | 说明 |
|------|------|------|
| health | `health` | 检查 API 连接状态 |
| stats | `stats` | 获取统计信息（笔记数、标签数、图片数、字数） |
| list | `list [--limit N] [--offset N]` | 列出笔记元数据（按创建时间降序） |
| read | `read <memo-id>` | 读取完整笔记内容（含 TipTap JSON） |
| create | `create --text "内容"` | 创建笔记，自动解析 #tag |
| update | `update <memo-id> --text "新内容"` | 更新笔记内容，自动保存版本历史 |
| delete | `delete <memo-id>` | 软删除笔记（可在应用回收站恢复） |
| search | `search --keyword <关键词> [--tag <标签>]` | 搜索笔记 |
| tags | `tags` | 列出所有标签及其关联的笔记 ID |
| export-json | `export-json <输出路径.zip>` | 导出全部笔记为 JSON 备份 ZIP |

### 常用操作示例

```bash
# 检查连接
npx tsx scripts/anyhark-cli.ts health

# 查看统计
npx tsx scripts/anyhark-cli.ts stats

# 列出最近 5 条笔记
npx tsx scripts/anyhark-cli.ts list --limit 5

# 搜索含 "产品" 关键词的笔记
npx tsx scripts/anyhark-cli.ts search --keyword "产品"

# 搜索特定标签下的笔记
npx tsx scripts/anyhark-cli.ts search --tag "thinking"

# 读取某条笔记完整内容
npx tsx scripts/anyhark-cli.ts read 01KKK5KXSPMD2B5DWPKXP9NG0J

# 创建一条带标签的笔记
npx tsx scripts/anyhark-cli.ts create --text "#ideas/product 这是一个产品想法"

# 更新笔记内容
npx tsx scripts/anyhark-cli.ts update 01KKK5KXSPMD2B5DWPKXP9NG0J --text "#ideas 更新后的内容"

# 导出全部笔记备份（需要用户主动确认，否则无需使用）
npx tsx scripts/anyhark-cli.ts export-json ~/Desktop/anyhark-backup.zip
```

## HTTP API 直接调用

如果 Agent 环境支持 HTTP 请求，可以直接调用 API（无需 CLI）：

```bash
# 列出笔记
curl http://127.0.0.1:17533/api/memos?limit=5

# 读取单条笔记
curl http://127.0.0.1:17533/api/memos/{id}

# 创建笔记（简化格式：纯文本自动解析 #tag）
curl -X POST http://127.0.0.1:17533/api/memos \
  -H "Content-Type: application/json" \
  -d '{"text": "#tag 笔记内容"}'

# 更新笔记
curl -X PUT http://127.0.0.1:17533/api/memos/{id} \
  -H "Content-Type: application/json" \
  -d '{"text": "新内容"}'

# 软删除（需要用户确认，并提醒用户属于软删除）
curl -X DELETE http://127.0.0.1:17533/api/memos/{id}

# 搜索
curl "http://127.0.0.1:17533/api/search?keyword=关键词&tag=标签"

# 标签列表
curl http://127.0.0.1:17533/api/tags

# 统计
curl http://127.0.0.1:17533/api/stats

# 导出
curl -X POST http://127.0.0.1:17533/api/export/json \
  -H "Content-Type: application/json" \
  -d '{"path": "/absolute/path/output.zip"}'
```

## 数据格式说明

### Memo 对象结构

```json
{
  "id": "01KKK5KXSPMD2B5DWPKXP9NG0J",
  "content": {
    "type": "doc",
    "content": [
      {
        "type": "paragraph",
        "content": [
          { "type": "tag", "attrs": { "path": "thinking", "label": "#thinking" } },
          { "type": "text", "text": " 笔记正文内容 " },
          { "type": "text", "text": "@Note-thinking-笔记前十个字", "marks": [{ "type": "mention-note", "attrs": { "memoId": "01KKK..." } }] },
          { "type": "text", "text": " " },
          { "type": "text", "text": "🔗 链接名称", "marks": [{ "type": "mention-link", "attrs": { "url": "https://example.com" } }] }
        ]
      }
    ]
  },
  "plainText": "#thinking 笔记正文内容",
  "tags": ["thinking"],
  "images": ["img_01HXYZ.jpg"],
  "createdAt": "2026-03-09T15:57:11.000Z",
  "updatedAt": "2026-03-09T15:57:11.000Z",
  "deletedAt": null,
  "versions": []
}
```

### MemoMeta（列表返回的轻量结构）

```json
{
  "id": "01KKK5KXSPMD2B5DWPKXP9NG0J",
  "tags": ["thinking"],
  "images": [],
  "plainTextPreview": "笔记内容预览（前300字）...",
  "wordCount": 42,
  "createdAt": "2026-03-09T15:57:11.000Z",
  "updatedAt": "2026-03-09T15:57:11.000Z",
  "deletedAt": null
}
```

### 创建/更新请求体

简化格式（推荐 Agent 使用）：

```json
{ "text": "#tag1 #tag2/子标签 笔记正文内容" }
```

标签会从 `#tag` 模式自动提取。支持多级标签如 `#parent/child`。

完整 TipTap 格式（高级用途）：

```json
{
  "content": { "type": "doc", "content": [...] },
  "plainText": "纯文本",
  "tags": ["tag1"],
  "images": []
}
```

## 注意事项

1. **不要直接操作数据文件**：直接修改 `memos/` 下的 JSON 文件会导致内存索引不一致，必须通过 API 操作
2. **APP 必须运行**：CLI 和 HTTP API 都依赖运行中的 Anyhark 应用
3. **实时同步**：通过 API 的写操作会自动通知 APP 界面刷新，无需手动操作
4. **删除是软删除**：`delete` 命令只做软删除，笔记可以在应用的回收站中恢复
5. **版本自动保存**：每次 `update` 操作会自动将旧内容保存为历史版本（最多 10 个）
6. **图片处理**：通过 CLI 创建的纯文本笔记不包含图片；如需附加图片需使用 APP 界面
7. **端口固定为 17533**：如该端口被占用会自动 +1，实际端口记录在 `~/Library/Application Support/anyhark/api-port`
8. **ID 格式**：笔记 ID 为 ULID 格式（26 位大写字母数字），按时间排序
