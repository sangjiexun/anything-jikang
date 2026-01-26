<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStorageConfig } from '~/composables/useStorageConfig'

interface MaterialItem {
  id: string
  name: string
  type: 'file' | 'folder'
  mimeType?: string
  size?: number
  content?: string // base64 for local preview
  url?: string // 服务器URL（用于编辑器插入）
  localUrl?: string // 本地预览URL
  parentId: string | null
  createdAt: number
  updatedAt: number
}

interface Folder {
  id: string
  name: string
  parentId: string | null
  children: string[] // item ids
}

// 使用共享的存储配置
const { uploadToStorage, loadStorageConfig } = useStorageConfig()

const props = defineProps<{
  knowledgeBases?: any[]
  selectedKnowledgeBase?: any
}>()

const emit = defineEmits(['select-material', 'update:selectedKnowledgeBase'])

// API
const { token } = useAuth()

// 状态
const materials = ref<MaterialItem[]>([])
const folders = ref<Folder[]>([])
const currentFolderId = ref<string | null>(null)
const isLoading = ref(false)
const isDragging = ref(false)
const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const showNewFolderDialog = ref(false)
const newFolderName = ref('')
const showRenameDialog = ref(false)
const renameTarget = ref<MaterialItem | null>(null)
const renameName = ref('')
const uploadProgress = ref<Map<string, number>>(new Map())
const contextMenu = ref<{ show: boolean; x: number; y: number; item: MaterialItem | null }>({
  show: false,
  x: 0,
  y: 0,
  item: null
})

// 存储键
const STORAGE_KEY = 'material_library_data'
const DB_NAME = 'MaterialLibraryDB'
const DB_VERSION = 1
const STORE_NAME = 'materials'

// IndexedDB 实例
let db: IDBDatabase | null = null

// 初始化 IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// 保存到 IndexedDB
const saveToIndexedDB = async (item: MaterialItem): Promise<void> => {
  if (!db) await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(item)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// 从 IndexedDB 删除
const deleteFromIndexedDB = async (id: string): Promise<void> => {
  if (!db) await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// 从 IndexedDB 加载所有
const loadFromIndexedDB = async (): Promise<MaterialItem[]> => {
  if (!db) await initDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// 保存文件夹结构到 localStorage
const saveFoldersToStorage = () => {
  localStorage.setItem(`${STORAGE_KEY}_folders`, JSON.stringify(folders.value))
}

// 从 localStorage 加载文件夹结构
const loadFoldersFromStorage = () => {
  const data = localStorage.getItem(`${STORAGE_KEY}_folders`)
  if (data) {
    folders.value = JSON.parse(data)
  }
}

// 生成唯一ID
const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

// 上传图片到服务器（使用共享的存储配置）
const uploadImageToServer = async (file: File): Promise<string> => {
  const result = await uploadToStorage(file, 'materials', token.value || undefined)
  return result.url
}

// 当前文件夹路径
const breadcrumbs = computed(() => {
  const path: { id: string | null; name: string }[] = [{ id: null, name: '根目录' }]
  let folderId = currentFolderId.value
  
  while (folderId) {
    const folder = folders.value.find(f => f.id === folderId)
    if (folder) {
      path.splice(1, 0, { id: folder.id, name: folder.name })
      folderId = folder.parentId
    } else {
      break
    }
  }
  
  return path
})

// 当前文件夹内的项目
const currentItems = computed(() => {
  let items = materials.value.filter(m => m.parentId === currentFolderId.value)
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = materials.value.filter(m => m.name.toLowerCase().includes(query))
  }
  
  // 文件夹排在前面
  return items.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (a.type !== 'folder' && b.type === 'folder') return 1
    return a.name.localeCompare(b.name)
  })
})

// 加载数据
const loadData = async () => {
  isLoading.value = true
  try {
    await initDB()
    materials.value = await loadFromIndexedDB()
    loadFoldersFromStorage()
  } catch (error) {
    console.error('加载素材库失败:', error)
  } finally {
    isLoading.value = false
  }
}

// 创建文件夹
const createFolder = async () => {
  if (!newFolderName.value.trim()) return
  
  const folder: MaterialItem = {
    id: generateId(),
    name: newFolderName.value.trim(),
    type: 'folder',
    parentId: currentFolderId.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  
  materials.value.push(folder)
  await saveToIndexedDB(folder)
  saveFoldersToStorage() // 保存文件夹结构
  
  newFolderName.value = ''
  showNewFolderDialog.value = false
}

// 处理文件上传
const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  
  isLoading.value = true
  
  for (const file of Array.from(input.files)) {
    await uploadFile(file)
  }
  
  isLoading.value = false
  input.value = ''
}

// 上传单个文件
const uploadFile = async (file: File): Promise<void> => {
  const tempId = generateId()
  uploadProgress.value.set(tempId, 0)
  
  try {
    // 读取文件内容用于本地预览
    const localContent = await readFileAsDataURL(file)
    
    let serverUrl = ''
    
    // 如果是图片，上传到服务器获取URL
    if (file.type.startsWith('image/')) {
      uploadProgress.value.set(tempId, 30)
      try {
        serverUrl = await uploadImageToServer(file)
        uploadProgress.value.set(tempId, 80)
      } catch (error) {
        console.warn('上传到服务器失败，使用本地存储:', error)
        // 上传失败时使用本地 base64
        serverUrl = localContent
      }
    } else {
      serverUrl = localContent
    }
    
    const item: MaterialItem = {
      id: generateId(),
      name: file.name,
      type: 'file',
      mimeType: file.type,
      size: file.size,
      content: localContent, // 本地预览用
      url: serverUrl, // 服务器URL（用于编辑器插入）
      localUrl: localContent,
      parentId: currentFolderId.value,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    materials.value.push(item)
    await saveToIndexedDB(item)
    uploadProgress.value.set(tempId, 100)
  } catch (error) {
    console.error('上传文件失败:', error)
  } finally {
    setTimeout(() => {
      uploadProgress.value.delete(tempId)
    }, 1000)
  }
}

// 读取文件为 DataURL
const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// 拖拽处理
const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

// 素材项拖拽开始 - 用于拖拽到编辑器
const handleItemDragStart = (event: DragEvent, item: MaterialItem) => {
  if (item.type === 'folder') {
    event.preventDefault()
    return
  }
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copy'
    
    // 构建拖拽数据，包含 base64 内容
    const dragData = {
      id: item.id,
      name: item.name,
      type: item.mimeType?.startsWith('image/') ? 'image' : 'file',
      mimeType: item.mimeType,
      url: item.url,
      content: item.content, // base64 内容
      source: 'material-library'
    }
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData))
    event.dataTransfer.setData('text/plain', item.name)
  }
}

const handleDrop = async (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false
  
  const files = event.dataTransfer?.files
  if (!files?.length) return
  
  isLoading.value = true
  
  for (const file of Array.from(files)) {
    await uploadFile(file)
  }
  
  isLoading.value = false
}

// 打开文件夹
const openFolder = (item: MaterialItem) => {
  if (item.type === 'folder') {
    currentFolderId.value = item.id
  }
}

// 导航到文件夹
const navigateToFolder = (folderId: string | null) => {
  currentFolderId.value = folderId
}

// 选择素材 - 发送服务器URL给编辑器
const selectMaterial = (item: MaterialItem) => {
  if (item.type === 'file') {
    emit('select-material', {
      id: item.id,
      name: item.name,
      type: item.mimeType,
      content: item.content,
      url: item.url // 使用服务器URL
    })
  }
}

// 双击处理
const handleDoubleClick = (item: MaterialItem) => {
  if (item.type === 'folder') {
    openFolder(item)
  } else {
    selectMaterial(item)
  }
}

// 右键菜单
const showContextMenu = (event: MouseEvent, item: MaterialItem) => {
  event.preventDefault()
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item
  }
}

const hideContextMenu = () => {
  contextMenu.value.show = false
}

// 重命名
const startRename = (item: MaterialItem) => {
  renameTarget.value = item
  renameName.value = item.name
  showRenameDialog.value = true
  hideContextMenu()
}

const confirmRename = async () => {
  if (!renameTarget.value || !renameName.value.trim()) return
  
  renameTarget.value.name = renameName.value.trim()
  renameTarget.value.updatedAt = Date.now()
  await saveToIndexedDB(renameTarget.value)
  
  showRenameDialog.value = false
  renameTarget.value = null
  renameName.value = ''
}

// 删除
const deleteItem = async (item: MaterialItem) => {
  if (!confirm(`确定要删除 "${item.name}" 吗？`)) return
  
  // 如果是文件夹，递归删除子项
  if (item.type === 'folder') {
    const childItems = materials.value.filter(m => m.parentId === item.id)
    for (const child of childItems) {
      await deleteItem(child)
    }
  }
  
  materials.value = materials.value.filter(m => m.id !== item.id)
  await deleteFromIndexedDB(item.id)
  hideContextMenu()
}

// 获取文件图标
const getFileIcon = (item: MaterialItem): string => {
  if (item.type === 'folder') return 'folder'
  
  const mimeType = item.mimeType || ''
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'movie'
  if (mimeType.startsWith('audio/')) return 'audio_file'
  if (mimeType.includes('pdf')) return 'picture_as_pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'description'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'table_chart'
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow'
  if (mimeType.includes('text')) return 'article'
  return 'insert_drive_file'
}

// 格式化文件大小
const formatSize = (bytes?: number): string => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 是否是图片
const isImage = (item: MaterialItem): boolean => {
  return item.mimeType?.startsWith('image/') || false
}

// 获取预览URL（优先使用本地内容）
const getPreviewUrl = (item: MaterialItem): string => {
  return item.localUrl || item.content || item.url || ''
}

// 点击外部关闭右键菜单
const handleClickOutside = () => {
  if (contextMenu.value.show) {
    hideContextMenu()
  }
}

onMounted(async () => {
  await loadStorageConfig()  // 加载存储配置
  loadData()
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="material-library h-full flex flex-col bg-white dark:bg-gray-900">
    <!-- 工具栏 -->
    <div class="flex-none border-b border-gray-200 dark:border-gray-700 p-3">
      <div class="flex items-center gap-2 mb-2">
        <!-- 搜索框 -->
        <div class="flex-1 relative">
          <span class="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索素材..."
            class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>
        
        <!-- 视图切换 -->
        <button
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="viewMode === 'grid' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'text-gray-500'"
          @click="viewMode = 'grid'"
        >
          <span class="material-symbols-outlined text-[20px]">grid_view</span>
        </button>
        <button
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          :class="viewMode === 'list' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30' : 'text-gray-500'"
          @click="viewMode = 'list'"
        >
          <span class="material-symbols-outlined text-[20px]">view_list</span>
        </button>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- 新建文件夹 -->
        <button
          class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="showNewFolderDialog = true"
        >
          <span class="material-symbols-outlined text-[16px]">create_new_folder</span>
          新建文件夹
        </button>
        
        <!-- 上传按钮 -->
        <label class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer">
          <span class="material-symbols-outlined text-[16px]">upload</span>
          上传文件
          <input
            type="file"
            multiple
            class="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md"
            @change="handleFileUpload"
          />
        </label>
      </div>
    </div>
    
    <!-- 面包屑导航 -->
    <div class="flex-none px-3 py-2 border-b border-gray-100 dark:border-gray-800">
      <div class="flex items-center gap-1 text-sm">
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id ?? 'root'">
          <button
            class="hover:text-blue-600 dark:hover:text-blue-400"
            :class="index === breadcrumbs.length - 1 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'"
            @click="navigateToFolder(crumb.id)"
          >
            {{ crumb.name }}
          </button>
          <span v-if="index < breadcrumbs.length - 1" class="text-gray-400">/</span>
        </template>
      </div>
    </div>
    
    <!-- 文件列表区域 -->
    <div
      class="flex-1 overflow-y-auto p-3"
      :class="{ 'bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400': isDragging }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 加载中 -->
      <div v-if="isLoading" class="flex items-center justify-center h-32">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
      
      <!-- 拖拽提示 -->
      <div v-else-if="isDragging" class="flex flex-col items-center justify-center h-32 text-blue-600 dark:text-blue-400">
        <span class="material-symbols-outlined text-[48px]">cloud_upload</span>
        <p class="mt-2 text-sm font-medium">释放文件以上传</p>
      </div>
      
      <!-- 空状态 -->
      <div v-else-if="currentItems.length === 0" class="flex flex-col items-center justify-center h-32 text-gray-400">
        <span class="material-symbols-outlined text-[48px]">folder_open</span>
        <p class="mt-2 text-sm">暂无素材</p>
        <p class="text-xs mt-1">拖拽文件到此处或点击上传按钮</p>
      </div>
      
      <!-- 网格视图 -->
      <div v-else-if="viewMode === 'grid'" class="grid grid-cols-3 gap-3">
        <div
          v-for="item in currentItems"
          :key="item.id"
          :draggable="item.type === 'file'"
          class="group relative bg-gray-50 dark:bg-gray-800 rounded-lg p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @dblclick="handleDoubleClick(item)"
          @contextmenu="showContextMenu($event, item)"
          @dragstart="handleItemDragStart($event, item)"
        >
          <!-- 预览区域 -->
          <div class="aspect-square rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <img
              v-if="isImage(item) && getPreviewUrl(item)"
              :src="getPreviewUrl(item)"
              :alt="item.name"
              class="w-full h-full object-cover"
            />
            <span v-else class="material-symbols-outlined text-[32px] text-gray-400">
              {{ getFileIcon(item) }}
            </span>
          </div>
          
          <!-- 文件名 -->
          <p class="mt-1.5 text-xs text-gray-700 dark:text-gray-300 truncate text-center" :title="item.name">
            {{ item.name }}
          </p>
          
          <!-- 悬浮操作按钮 -->
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              class="p-1 bg-white dark:bg-gray-900 rounded shadow-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              @click.stop="showContextMenu($event, item)"
            >
              <span class="material-symbols-outlined text-[16px] text-gray-500">more_vert</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 列表视图 -->
      <div v-else class="space-y-1">
        <div
          v-for="item in currentItems"
          :key="item.id"
          class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          @dblclick="handleDoubleClick(item)"
          @contextmenu="showContextMenu($event, item)"
        >
          <!-- 图标 -->
          <div class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <img
              v-if="isImage(item) && getPreviewUrl(item)"
              :src="getPreviewUrl(item)"
              :alt="item.name"
              class="w-full h-full object-cover rounded-lg"
            />
            <span v-else class="material-symbols-outlined text-[24px] text-gray-400">
              {{ getFileIcon(item) }}
            </span>
          </div>
          
          <!-- 文件信息 -->
          <div class="flex-1 min-w-0">
            <p class="text-sm text-gray-900 dark:text-white truncate">{{ item.name }}</p>
            <p class="text-xs text-gray-500">
              {{ item.type === 'folder' ? '文件夹' : formatSize(item.size) }}
            </p>
          </div>
          
          <!-- 操作按钮 -->
          <button
            class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            @click.stop="showContextMenu($event, item)"
          >
            <span class="material-symbols-outlined text-[20px] text-gray-400">more_vert</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        class="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[120px]"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <button
          v-if="contextMenu.item?.type === 'folder'"
          class="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          @click="openFolder(contextMenu.item!)"
        >
          <span class="material-symbols-outlined text-[18px]">folder_open</span>
          打开
        </button>
        <button
          v-if="contextMenu.item?.type === 'file'"
          class="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          @click="selectMaterial(contextMenu.item!); hideContextMenu()"
        >
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          插入到编辑器
        </button>
        <button
          class="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          @click="startRename(contextMenu.item!)"
        >
          <span class="material-symbols-outlined text-[18px]">edit</span>
          重命名
        </button>
        <button
          class="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          @click="deleteItem(contextMenu.item!)"
        >
          <span class="material-symbols-outlined text-[18px]">delete</span>
          删除
        </button>
      </div>
    </Teleport>
    
    <!-- 新建文件夹对话框 -->
    <Teleport to="body">
      <div v-if="showNewFolderDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white dark:bg-gray-900 rounded-xl p-4 w-80 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">新建文件夹</h3>
          <input
            v-model="newFolderName"
            type="text"
            placeholder="文件夹名称"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            @keyup.enter="createFolder"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button
              class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800"
              @click="showNewFolderDialog = false; newFolderName = ''"
            >
              取消
            </button>
            <button
              class="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              @click="createFolder"
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 重命名对话框 -->
    <Teleport to="body">
      <div v-if="showRenameDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="bg-white dark:bg-gray-900 rounded-xl p-4 w-80 shadow-xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">重命名</h3>
          <input
            v-model="renameName"
            type="text"
            placeholder="新名称"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            @keyup.enter="confirmRename"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button
              class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-400 dark:hover:bg-gray-800"
              @click="showRenameDialog = false; renameTarget = null"
            >
              取消
            </button>
            <button
              class="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              @click="confirmRename"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.material-library {
  min-height: 300px;
}
</style>
