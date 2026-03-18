export const IPC_CHANNELS = {
  MEMO_CREATE: 'memo:create',
  MEMO_READ: 'memo:read',
  MEMO_UPDATE: 'memo:update',
  MEMO_DELETE: 'memo:delete',
  MEMO_LIST: 'memo:list',
  MEMO_VERSIONS: 'memo:versions',
  MEMO_RESTORE_VERSION: 'memo:restore-version',
  TAG_LIST: 'tag:list',
  TAG_RENAME: 'tag:rename',
  TAG_DELETE: 'tag:delete',
  SEARCH_QUERY: 'search:query',
  IMAGE_SAVE: 'image:save',
  IMAGE_LOAD: 'image:load',
  RECYCLE_LIST: 'recycle:list',
  RECYCLE_RESTORE: 'recycle:restore',
  RECYCLE_PURGE: 'recycle:purge',
  RECYCLE_EMPTY: 'recycle:empty'
} as const

export const APP_NAME = 'Anyhark'

export const MAX_PREVIEW_LENGTH = 100
export const MAX_VERSIONS = 50
export const MEMO_MAX_LENGTH = 5000
