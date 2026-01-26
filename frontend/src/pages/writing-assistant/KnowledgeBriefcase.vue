<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useApi } from '../../composables/useApi'
import { useNotification } from '../../composables/useNotification'
import { useStorageConfig } from '../../composables/useStorageConfig'
import StorageConfigDialog from '../StorageConfigDialog.vue'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// 使用共享的存储配置
const { uploadToStorageWithDetails, loadStorageConfig } = useStorageConfig()

// 存储配置对话框状态
const showStorageConfig = ref(false)

// 文件名缓存 - 用于存储 COS key 到原始文件名的映射
const FILE_NAME_CACHE_KEY = 'cos_file_name_cache'
const fileNameCache = ref<Record<string, string>>({})

// 加载文件名缓存
const loadFileNameCache = () => {
  try {
    const cached = localStorage.getItem(FILE_NAME_CACHE_KEY)
    if (cached) {
      fileNameCache.value = JSON.parse(cached)
    }
  } catch (e) {
    console.error('加载文件名缓存失败:', e)
  }
}

// 保存文件名缓存
const saveFileNameCache = () => {
  try {
    localStorage.setItem(FILE_NAME_CACHE_KEY, JSON.stringify(fileNameCache.value))
  } catch (e) {
    console.error('保存文件名缓存失败:', e)
  }
}

// 添加文件名到缓存
const cacheFileName = (key: string, originalName: string) => {
  fileNameCache.value[key] = originalName
  saveFileNameCache()
}

// 从缓存获取原始文件名
const getOriginalFileName = (key: string, fallbackName: string): string => {
  // 首先检查缓存
  if (fileNameCache.value[key]) {
    return fileNameCache.value[key]
  }
  
  // 尝试从 key 中解析原始文件名
  // 格式: folder/timestamp_random_originalName.ext
  const fileName = key.split('/').pop() || fallbackName
  const parts = fileName.split('_')
  
  if (parts.length >= 3) {
    // 移除时间戳和随机字符串，保留原始文件名
    const originalName = parts.slice(2).join('_')
    if (originalName) {
      return originalName
    }
  }
  
  return fallbackName
}

interface KnowledgeBase {
  id: string
  name: string
  type: string
  description?: string
}

const props = defineProps<{
  selectedKnowledgeBase?: KnowledgeBase | null
  knowledgeBases?: KnowledgeBase[]
}>()

interface FileItem {
  id: string
  name: string
  type: 'folder' | 'file' | 'image' | 'pdf' | '基础知识库' | '训练知识库' | '多元知识库'
  path: string
  content?: string // Preview content for files
  imageUrl?: string // URL for images
  updatedAt: string
  size?: number // File size in bytes
}

const emit = defineEmits(['select-material', 'drag-start', 'reference-updated', 'update:selectedKnowledgeBase'])

const searchQuery = ref('')
const currentPath = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const files = ref<FileItem[]>([])
const uploadProgress = ref<number>(0)
const isUploading = ref<boolean>(false)

// 多选相关状态
const selectedFiles = ref<Set<string>>(new Set())
const isAllSelected = ref(false)

// 预览相关状态
const showPreview = ref(false)
const previewItem = ref<FileItem | null>(null)
const previewContent = ref('')
const isLoadingContent = ref(false)
const fileStats = ref({
  fileType: '',
  fileSize: 0,
  wordCount: 0,
  sliceCount: 0
})

// 参考片段相关状态
const selectedReferences = ref<{id: string, content: string, source: string}[]>([])

// 拖拽排序相关状态
const dragOverItem = ref<string | null>(null)
const draggedItem = ref<FileItem | null>(null)

// 删除功能相关状态
const showDeleteDialog = ref(false)
const deleteItem = ref<FileItem | null>(null)

// 编辑相关状态
const showEditDialog = ref(false)
const editItem = ref<FileItem | null>(null)

const api = useApi()
const { add: notify } = useNotification()

// Helper function to determine file type
const getFileType = (filename: string): 'folder' | 'file' | 'image' | 'pdf' => {
  const extension = filename.toLowerCase().split('.').pop() || ''

  if (extension === '') {
    return 'folder' // Assume no extension means folder
  }

  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
    return 'image'
  }

  if (extension === 'pdf') {
    return 'pdf'
  }

  return 'file'
}

// 固定知识库分类
const fixedCategories = [
  { 
    name: '基础知识库', 
    type: 'folder' as const, 
    path: '/基础知识库',
    description: '认知蒸馏形成的文本数据库，目的为解决精准问题'
  },
  { 
    name: '训练知识库', 
    type: 'folder' as const, 
    path: '/训练知识库',
    description: '行动聚焦形成的张量数据库，目的为解决适配问题'
  },
  { 
    name: '多元知识库', 
    type: 'folder' as const, 
    path: '/多元知识库',
    description: '对齐涌现形成的先验数据库，解决动态转化问题'
  }
]

// 检查是否为固定分类
const isFixedCategory = (path: string): boolean => {
  return fixedCategories.some(category => category.path === path)
}

// Load files from 腾讯云 COS
const loadFiles = async () => {
  loading.value = true

  try {
    // 使用 COS 列表 API 获取文件
    const response: any = await api.get('/cos/list', { prefix: 'knowledge/' })

    let processedFiles: FileItem[] = []
    const folderSet = new Set<string>() // 用于收集文件夹

    if (response.success && response.files) {
      // Process files from COS response
      response.files.forEach((file: any) => {
        // COS key 格式: knowledge/个人知识库/xxx.txt
        // 需要转换为: /个人知识库/xxx.txt
        const key = file.key
        
        // 跳过空文件名（可能是文件夹占位符）
        if (key.endsWith('/')) {
          return
        }
        
        // 移除 'knowledge/' 前缀
        const relativePath = key.startsWith('knowledge/') ? key.substring('knowledge/'.length) : key
        const pathParts = relativePath.split('/')
        const fileName = pathParts.pop() || ''
        
        // 跳过空文件名
        if (!fileName) {
          return
        }
        
        // 收集文件夹路径
        let currentFolderPath = ''
        for (let i = 0; i < pathParts.length; i++) {
          currentFolderPath += '/' + pathParts[i]
          folderSet.add(currentFolderPath)
        }
        
        const folderPath = pathParts.length > 0 ? '/' + pathParts.join('/') : ''
        const fullPath = folderPath + '/' + fileName
        
        // 获取原始文件名（从缓存或解析 key）
        const originalName = getOriginalFileName(key, fileName)

        processedFiles.push({
          id: key,
          name: originalName, // 使用原始文件名
          type: getFileType(originalName),
          path: fullPath,
          updatedAt: file.lastModified,
          size: file.size
        })
      })
      
      // 添加从文件路径中提取的文件夹
      folderSet.forEach(folderPath => {
        const folderName = folderPath.split('/').pop() || ''
        if (folderName && !fixedCategories.some(cat => cat.path === folderPath)) {
          processedFiles.push({
            id: folderPath,
            name: folderName,
            type: 'folder' as const,
            path: folderPath,
            updatedAt: new Date().toISOString(),
            size: 0
          })
        }
      })
    }

    // Add default knowledge base categories as folders if they don't exist
    fixedCategories.forEach((category) => {
      const exists = processedFiles.some(file =>
        file.path === category.path && file.type === 'folder'
      )

      if (!exists) {
        processedFiles.push({
          id: category.path,
          name: category.name,
          type: category.type,
          path: category.path,
          updatedAt: new Date().toISOString(),
          size: 0
        })
      }
    })

    // Add user knowledge bases as folders if they don't exist
    if (props.knowledgeBases) {
      props.knowledgeBases.forEach((kb) => {
        const kbPath = `/${kb.name}`
        const exists = processedFiles.some(file =>
          file.path === kbPath && file.type === 'folder'
        )

        if (!exists) {
          processedFiles.push({
            id: kbPath,
            name: kb.name,
            type: 'folder' as const,
            path: kbPath,
            updatedAt: new Date().toISOString(),
            size: 0
          })
        }
      })
    }

    files.value = processedFiles
    console.log('COS 文件列表加载完成:', processedFiles.length, '个项目')
  } catch (error) {
    console.error('Failed to load files:', error)
    notify('加载文件列表失败', 'error')
  } finally {
    loading.value = false
  }
}

// 创建新文件夹
const createNewFolder = async () => {
  const folderName = prompt('请输入新文件夹名称:')
  if (!folderName || folderName.trim() === '') {
    return
  }

  try {
    // 构建新文件夹路径
    const newFolderPath = currentPath.value.length > 0 
      ? `/${currentPath.value.join('/')}/${folderName.trim()}` 
      : `/${folderName.trim()}`

    // 检查文件夹是否已存在
    const exists = files.value.some(file =>
      file.path === newFolderPath && file.type === 'folder'
    )

    if (exists) {
      notify('文件夹已存在', 'warning')
      return
    }

    // 首先调用后端API创建文件夹
    const response: any = await api.post('/cos/create-folder', { 
      path: `knowledge${newFolderPath}`  // 添加 knowledge 前缀以符合COS存储结构
    })
    
    if (!response.success) {
      notify(`文件夹创建失败: ${response.message}`, 'error')
      return
    }

    // 添加新文件夹到文件列表
    files.value.push({
      id: newFolderPath,  // 保留原来的路径用于内部引用
      name: folderName.trim(),
      type: 'folder' as const,
      path: newFolderPath,
      updatedAt: new Date().toISOString(),
      size: 0
    })

    notify(`文件夹 "${folderName.trim()}" 创建成功`, 'success')
  } catch (error) {
    console.error('创建文件夹失败:', error)
    notify('创建文件夹失败', 'error')
  }
}

// Load files from selected knowledge base
const loadKnowledgeBaseFiles = async (knowledgeBase: any) => {
  loading.value = true

  try {
    console.log('Loading knowledge base files for:', knowledgeBase)
    if (!knowledgeBase || !knowledgeBase.id) {
      console.warn('Invalid knowledge base provided to loadKnowledgeBaseFiles:', knowledgeBase)
      files.value = []
      currentPath.value = []
      return
    }
    const response: any = await api.get(`/knowledge-bases/${knowledgeBase.id}/documents`)

    console.log('API response:', response)

    let allFiles: FileItem[] = []

    // Process documents from knowledge base
    if (response.success && response.data && Array.isArray(response.data.documents)) {
      allFiles = response.data.documents.map((doc: any) => {
        // Parse filename to determine file type
        const originalFileName = doc.file_name || doc.title || 'unknown-file'
        // Extract only the filename part, removing any path components
        const fileName = originalFileName.split('/').pop() || originalFileName

        return {
          id: doc.id,
          name: fileName,
          type: getFileType(fileName),
          path: `/${knowledgeBase.name}/${fileName}`,
          updatedAt: doc.created_at || new Date().toISOString(),
          size: doc.file_size || 0
        }
      })

      console.log('Processed documents:', allFiles)
    } else {
      console.error('API returned error:', response.message)
      notify('加载知识库文档失败', 'error')
      // Reset files to empty array when API fails
      files.value = []
      // Reset current path to avoid displaying empty content
      currentPath.value = []
      return
    }

    // Also load folders from COS that belong to this knowledge base
    try {
      const cosResponse: any = await api.get('/cos/list', { prefix: `knowledge/${knowledgeBase.name}/` })
      
      if (cosResponse.success && cosResponse.files) {
        const folderSet = new Set<string>()
        
        // Extract folders from COS file paths
        cosResponse.files.forEach((file: any) => {
          const key = file.key
          if (key.endsWith('/')) {
            // This is a folder object
            const relativePath = key.startsWith('knowledge/') ? key.substring('knowledge/'.length) : key
            if (relativePath.startsWith(`${knowledgeBase.name}/`)) {
              // Extract folder path - remove the knowledge base name and get the rest of the path
              const pathParts = relativePath.split('/').filter(p => p) // ['个人知识库', '123']
              if (pathParts.length > 1) {
                // Keep everything after the knowledge base name
                const folderPath = '/' + pathParts.slice(1).join('/') // ['123'] -> '/123'
                if (folderPath && folderPath !== '/') {
                  folderSet.add(folderPath)
                }
              }
            }
          } else {
            // This is a regular file, extract its folder path
            const relativePath = key.startsWith('knowledge/') ? key.substring('knowledge/'.length) : key
            if (relativePath.startsWith(`${knowledgeBase.name}/`)) {
              const pathParts = relativePath.split('/').filter(p => p)
              if (pathParts.length > 2) { // Need at least KB name + folder + file
                const folderPath = '/' + pathParts.slice(1, -1).join('/') // exclude the file name
                if (folderPath && folderPath !== '/') {
                  folderSet.add(folderPath)
                }
              }
            }
          }
        })

        // Add folders to the file list
        folderSet.forEach(folderPath => {
          const folderName = folderPath.split('/').pop() || ''
          // Construct the full path with knowledge base name prefix
          const fullPath = `/${knowledgeBase.name}${folderPath}`
          if (folderName && !allFiles.some(f => f.path === fullPath && f.type === 'folder')) {
            allFiles.push({
              id: `folder-${fullPath}`,
              name: folderName,
              type: 'folder' as const,
              path: fullPath,
              updatedAt: new Date().toISOString(),
              size: 0
            })
          }
        })
      }
    } catch (cosError) {
      console.error('Error loading COS folders:', cosError)
      // Continue with just the documents if COS fails
    }

    files.value = allFiles

    // Set current path to the knowledge base folder to display its files
    currentPath.value = [knowledgeBase.name]

    notify(`已加载 ${allFiles.length} 个项目`, 'success')
  } catch (error) {
    console.error('Failed to load knowledge base files:', error)
    notify('加载知识库文档失败', 'error')
    // Reset files to empty array when API fails
    files.value = []
    // Reset current path to avoid displaying empty content
    currentPath.value = []
  } finally {
    loading.value = false
  }
}



// Load files on component mount and when selectedKnowledgeBase changes
onMounted(async () => {
  await loadStorageConfig() // 加载存储配置
  loadFileNameCache() // 加载文件名缓存
  loadFiles()
})

// 处理知识库选择
const handleKnowledgeBaseSelect = (kb: KnowledgeBase) => {
  // 发出事件通知父组件
  emit('update:selectedKnowledgeBase', kb)
}

// Watch for changes to selectedKnowledgeBase
watch(
  () => props.selectedKnowledgeBase,
  (newKb) => {
    if (newKb) {
      loadKnowledgeBaseFiles(newKb)
    } else {
      // If no knowledge base is selected, load default files
      loadFiles()
    }
  },
  { immediate: true }
)

// Watch for changes to knowledgeBases to update the folder list
watch(
  () => props.knowledgeBases,
  (newKbs) => {
    // Reload files when knowledge bases list changes to reflect updates
    // This ensures the folder list stays in sync with parent component
    loadFiles()
  },
  { deep: true }
)

// Get files for current path
const currentItems = computed(() => {
  if (searchQuery.value) {
    return files.value.filter(item =>
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  // Get items in current directory
  return files.value.filter((item) => {
    // For knowledge base files, always show them when current path matches knowledge base name
    if (props.selectedKnowledgeBase) {
      return item.path.startsWith(`/${props.selectedKnowledgeBase.name}/`)
    }
    
    // For root level, show fixed categories, user knowledge bases, COS folders, and files in root
    if (currentPath.value.length === 0) {
      // Show fixed categories
      if (fixedCategories.some(cat => cat.path === item.path)) {
        return true
      }
      
      // Show user knowledge bases as folders
      if (props.knowledgeBases && props.knowledgeBases.some(kb => item.path === `/${kb.name}`)) {
        return true
      }
      
      // Show folders and files directly in root (path like /xxx or /folderName)
      const pathParts = item.path.split('/').filter(Boolean)
      if (pathParts.length === 1) {
        return true
      }
      
      return false
    }
    
    // For nested paths (e.g., currentPath = ['个人知识库'])
    const itemPathParts = item.path.split('/').filter(Boolean)
    const currentPathParts = currentPath.value.filter(Boolean)

    // Check if item is directly in current directory
    if (itemPathParts.length === currentPathParts.length + 1) {
      // File/folder is directly in current directory
      const itemParentPath = itemPathParts.slice(0, -1).join('/')
      const currentPathStr = currentPathParts.join('/')
      return itemParentPath === currentPathStr
    }

    return false
  })
})

const breadcrumbs = computed(() => {
  return ['根目录', ...currentPath.value]
})

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 计算文本字数（中文按字符算，英文按单词算）
const calculateWordCount = (text: string): number => {
  if (!text) return 0
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0
  const englishWords = text.match(/\b[a-zA-Z]+\b/g)?.length || 0
  return chineseChars + englishWords
}

// 加载文件内容
const loadFileContent = async (item: FileItem) => {
  isLoadingContent.value = true
  try {
    // 重置预览状态
    fileStats.value = {
      fileType: '',
      fileSize: 0,
      wordCount: 0,
      sliceCount: 0
    }

    // 根据文件类型加载内容
    if (item.type === 'file') {
      // 使用 COS 读取 API 获取文件内容
      // item.id 就是 COS key
      const cosKey = item.id
      
      console.log('正在从 COS 读取文件:', cosKey)

      const response: any = await api.get('/cos/read', { key: cosKey })

      let content: string
      if (response.success && response.content) {
        content = response.content
        console.log('COS 文件读取成功，内容长度:', content.length)
      } else {
        // 如果API调用失败，显示错误信息
        content = `无法加载文件内容: ${response.message || '未知错误'}\n\n文件: ${item.name}\nCOS Key: ${cosKey}`
      }

      item.content = content
      previewContent.value = content

      // 计算文件统计信息
      const wordCount = calculateWordCount(content)

      fileStats.value = {
        fileType: item.type,
        fileSize: item.size || 0,
        wordCount: wordCount,
        sliceCount: 0
      }
    } else if (item.type === 'pdf') {
      // 对于PDF文件，可以考虑实现更复杂的预览功能
      // 暂时显示基本信息
      const content = `PDF文件预览: ${item.name}\n\n文件大小: ${item.size ? formatFileSize(item.size) : '未知'}\n更新时间: ${item.updatedAt}\n\n实际应用中，这里会显示PDF的可视化预览。`

      previewContent.value = content
      item.content = content

      fileStats.value = {
        fileType: item.type,
        fileSize: item.size || 0,
        wordCount: 0,
        sliceCount: 0
      }
    } else if (item.type === 'image') {
      // 对于图片文件，显示图片信息
      const content = `图片文件预览: ${item.name}\n\n文件大小: ${item.size ? formatFileSize(item.size) : '未知'}\n更新时间: ${item.updatedAt}\n\n实际应用中，这里会显示图片的预览。`

      previewContent.value = content
      item.content = content

      fileStats.value = {
        fileType: item.type,
        fileSize: item.size || 0,
        wordCount: 0,
        sliceCount: 0
      }
    }
  } catch (error) {
    console.error('加载文件内容失败:', error)
    // 如果API调用失败，显示错误信息
    const content = `加载文件内容失败\n\n文件: ${item.name}\n错误: ${error instanceof Error ? error.message : '未知错误'}`

    item.content = content
    previewContent.value = content

    // 计算模拟内容的统计信息
    const wordCount = calculateWordCount(content)

    fileStats.value = {
      fileType: item.type,
      fileSize: item.size || 0,
      wordCount: wordCount,
      sliceCount: 0
    }

    notify('加载文件内容失败', 'error')
  } finally {
    isLoadingContent.value = false
  }
}

// 打开预览
const openPreview = async (item: FileItem) => {
  if (item.type === 'image') {
    emit('select-material', item)
    return
  }

  previewItem.value = item
  await loadFileContent(item)
  showPreview.value = true
}

// 关闭预览
const closePreview = () => {
  showPreview.value = false
  previewItem.value = null
  previewContent.value = ''
}

// 复制内容
const copyContent = () => {
  if (previewContent.value) {
    navigator.clipboard.writeText(previewContent.value)
      .then(() => {
        notify('内容已复制到剪贴板', 'success')
      })
      .catch((err) => {
        console.error('复制失败:', err)
        notify('复制失败，请手动复制', 'error')
      })
  }
}

// 一键格式转换
const handleFormatConvert = async () => {
  if (!previewItem.value) {
    notify('请先预览文件内容', 'warning')
    return
  }

  try {
    notify('正在转换文件格式...', 'info')

    const fileName = previewItem.value.name
    const fileExtension = fileName.split('.').pop()?.toLowerCase()
    let markdownContent = ''

    switch (fileExtension) {
      case 'md':
      case 'markdown':
      case 'txt':
        // 对于文本文件，直接使用预览内容
        markdownContent = previewContent.value
        break

      case 'doc':
      case 'docx':
        // 对于 Word 文档，需要从 COS 下载并转换
        markdownContent = await convertDocxFromCOS(previewItem.value.id)
        break

      case 'pdf':
        // 对于 PDF，需要从 COS 下载并转换
        markdownContent = await convertPdfFromCOS(previewItem.value.id)
        break

      default:
        // 对于其他文本格式，尝试直接使用预览内容
        if (previewContent.value) {
          markdownContent = previewContent.value
        } else {
          throw new Error(`不支持的文件格式: .${fileExtension}`)
        }
    }

    if (!markdownContent) {
      throw new Error('文件转换失败')
    }

    // 发送到编辑器
    emit('select-material', {
      id: previewItem.value.id,
      name: previewItem.value.name,
      content: markdownContent,
      type: 'markdown'
    })

    notify('格式转换完成，内容已发送到编辑器', 'success')
    closePreview()
  } catch (error: any) {
    console.error('格式转换失败:', error)
    notify(`格式转换失败: ${error.message || '未知错误'}`, 'error')
  }
}

// 从 COS 读取并转换 DOCX 为 Markdown
const convertDocxFromCOS = async (cosKey: string): Promise<string> => {
  try {
    const response: any = await api.get('/cos/read', { key: cosKey })
    
    if (!response.success) {
      throw new Error('无法读取文件: ' + response.message)
    }
    
    if (response.isBase64) {
      // 将 base64 转换为 ArrayBuffer
      const binaryString = atob(response.content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const arrayBuffer = bytes.buffer
      
      const result = await mammoth.extractRawText({ arrayBuffer })
      return result.value
    }
    
    throw new Error('DOCX 文件格式不正确')
  } catch (error: any) {
    console.error('DOCX 转换失败:', error)
    throw new Error(`DOCX 转换失败: ${error.message}`)
  }
}

// 从 COS 读取并转换 PDF 为 Markdown
const convertPdfFromCOS = async (cosKey: string): Promise<string> => {
  try {
    const response: any = await api.get('/cos/read', { key: cosKey })
    
    if (!response.success) {
      throw new Error('无法读取文件: ' + response.message)
    }
    
    if (response.isBase64) {
      // 将 base64 转换为 ArrayBuffer
      const binaryString = atob(response.content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const arrayBuffer = bytes.buffer
      
      const loadingTask = pdfjsLib.getDocument(arrayBuffer)
      const pdf = await loadingTask.promise
      
      let markdown = ''
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
        
        markdown += `## 第 ${pageNum} 页\n\n${pageText}\n\n`
      }
      
      return markdown
    }
    
    throw new Error('PDF 文件格式不正确')
  } catch (error: any) {
    console.error('PDF 转换失败:', error)
    throw new Error(`PDF 转换失败: ${error.message}`)
  }
}

// 批量转换函数
const handleBatchConvert = async () => {
  if (selectedFiles.value.size === 0) {
    notify('请先选择要转换的文件', 'warning')
    return
  }

  const selectedFileItems = currentItems.value.filter(item => selectedFiles.value.has(item.id) && item.type !== 'folder')
  
  if (selectedFileItems.length === 0) {
    notify('请选择有效的文件进行转换', 'warning')
    return
  }

  isUploading.value = true
  uploadProgress.value = 0

  let successCount = 0
  let failCount = 0
  const failedFiles: string[] = []

  try {
    for (let i = 0; i < selectedFileItems.length; i++) {
      const file = selectedFileItems[i]
      const progress = Math.round(((i + 1) / selectedFileItems.length) * 100)
      uploadProgress.value = progress

      try {
        // 转换文件为 Markdown
        const markdownContent = await convertFileToMarkdown(file)
        
        // 上传到 COS 替换原文件
        await uploadMarkdownToCos(file, markdownContent)
        
        successCount++
        notify(`转换成功: ${file.name} (${i + 1}/${selectedFileItems.length})`, 'success')
      } catch (error: any) {
        failCount++
        failedFiles.push(file.name)
        console.error(`转换失败 ${file.name}:`, error)
        notify(`转换失败: ${file.name} - ${error.message}`, 'error')
      }
    }

    // 刷新文件列表
    if (props.selectedKnowledgeBase) {
      await loadKnowledgeBaseFiles(props.selectedKnowledgeBase)
    } else {
      await loadFiles()
    }

    // 清除选择
    clearSelection()

    // 显示汇总结果
    if (failCount === 0) {
      notify(`批量转换完成！成功转换 ${successCount} 个文件`, 'success')
    } else {
      notify(`批量转换完成！成功 ${successCount} 个，失败 ${failCount} 个`, 'warning')
    }
  } catch (error: any) {
    console.error('批量转换失败:', error)
    notify(`批量转换失败: ${error.message}`, 'error')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// 转换单个文件为 Markdown
const convertFileToMarkdown = async (file: FileItem): Promise<string> => {
  const fileName = file.name
  const fileExtension = fileName.split('.').pop()?.toLowerCase()

  switch (fileExtension) {
    case 'md':
    case 'markdown':
    case 'txt':
      // 对于文本文件，直接读取内容
      // 如果文件的id是以'knowledge/'开头的COS key，直接使用id；否则，构建完整的COS路径
      const fileKey = file.id.startsWith('knowledge/') ? file.id : `knowledge/${file.path.split('/').slice(1).join('/')}`
      const response: any = await api.get('/cos/read', { key: fileKey })
      if (!response.success || !response.content) {
        throw new Error('无法读取文件')
      }
      return response.content

    case 'doc':
    case 'docx':
      return await convertDocxToMarkdown(file.path)

    case 'pdf':
      return await convertPdfToMarkdown(file.path)

    default:
      throw new Error(`不支持的文件格式: .${fileExtension}`)
  }
}

// 上传 Markdown 到 COS 替换原文件
const uploadMarkdownToCos = async (originalFile: FileItem, markdownContent: string) => {
  try {
    // 创建新的文件名（将原扩展名改为 .md）
    const newFileName = originalFile.name.replace(/\.[^/.]+$/, '') + '.md'
    const pathParts = originalFile.path.split('/').filter(Boolean)
    const folderPath = pathParts.slice(1, -1).join('/')
    const newFilePath = folderPath ? `/${folderPath}/${newFileName}` : `/${newFileName}`

    // 创建 Blob 对象
    const blob = new Blob([markdownContent], { type: 'text/markdown' })
    
    // 创建 FormData 并添加文件及文件夹信息
    const formData = new FormData()
    formData.append('file', blob, newFileName)
    formData.append('folder', folderPath || 'uploads') // 使用COS上传API的folder参数

    // 上传新文件
    const uploadResponse: any = await api.post('/cos/upload', formData)

    if (!uploadResponse.success) {
      throw new Error('上传失败: ' + uploadResponse.message)
    }

    // 删除原文件
    let deleteKey = '';
    // 如果文件的id是以'knowledge/'开头的COS key，直接使用id；否则，构建完整的COS路径
    if (originalFile.id.startsWith('knowledge/')) {
      deleteKey = originalFile.id;
    } else {
      const pathParts = originalFile.path.split('/').filter(Boolean);
      deleteKey = pathParts.length > 0 ? `knowledge/${pathParts.join('/')}` : originalFile.id;
    }
    
    const deleteResponse: any = await api.delete(`/cos/delete?key=${encodeURIComponent(deleteKey)}`)

    if (!deleteResponse.success) {
      console.warn('原文件删除失败，但新文件已上传:', originalFile.name)
    }
  } catch (error: any) {
    console.error('上传到 COS 失败:', error)
    throw new Error(`上传失败: ${error.message}`)
  }
}

// 读取文件内容
const readFileContent = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      resolve(e.target?.result as string || '')
    }
    reader.onerror = () => {
      reject(new Error('文件读取失败'))
    }
    reader.readAsText(file)
  })
}

// 转换 DOCX 为 Markdown
const convertDocxToMarkdown = async (filePath: string): Promise<string> => {
  try {
    // 构建正确的COS文件key
    const pathParts = filePath.split('/').filter(Boolean)
    const fileKey = pathParts.length > 0 ? `knowledge/${pathParts.join('/')}` : filePath

    const response: any = await api.get('/cos/read', { key: fileKey })

    if (!response.success || !response.content) {
      throw new Error('无法读取 DOCX 文件')
    }

    const arrayBuffer = new TextEncoder().encode(response.content).buffer

    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  } catch (error: any) {
    console.error('DOCX 转换失败:', error)
    throw new Error(`DOCX 转换失败: ${error.message}`)
  }
}

// 转换 PDF 为 Markdown
const convertPdfToMarkdown = async (filePath: string): Promise<string> => {
  try {
    // 构建正确的COS文件key
    const pathParts = filePath.split('/').filter(Boolean)
    const fileKey = pathParts.length > 0 ? `knowledge/${pathParts.join('/')}` : filePath

    const response: any = await api.get('/cos/read', { key: fileKey })

    if (!response.success || !response.content) {
      throw new Error('无法读取 PDF 文件')
    }

    const arrayBuffer = new TextEncoder().encode(response.content).buffer

    const loadingTask = pdfjsLib.getDocument(arrayBuffer)
    const pdf = await loadingTask.promise

    let markdown = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      markdown += `## 第 ${pageNum} 页\n\n${pageText}\n\n`
    }

    return markdown
  } catch (error: any) {
    console.error('PDF 转换失败:', error)
    throw new Error(`PDF 转换失败: ${error.message}`)
  }
}

const handleItemClick = (item: FileItem) => {
  if (item.type === 'folder') {
    currentPath.value.push(item.name)
  } else {
    openPreview(item)
  }
}

const navigateToBreadcrumb = (index: number) => {
  if (index === 0) {
    currentPath.value = []
  } else {
    currentPath.value = currentPath.value.slice(0, index)
  }
}

// File Upload Functions
const triggerFileUpload = () => {
  fileInput.value?.click()
}

const handleFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (files) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      await uploadFile(file)
    }
  }

  // Reset file input to allow re-uploading the same file
  if (input) {
    input.value = ''
  }
}

// 智能分析文件内容并匹配知识库
const analyzeAndMatchKnowledgeBase = async (file: File): Promise<string | null> => {
  try {
    notify('正在分析文件内容...', 'info')

    // 读取文件内容（简单实现，实际项目中可能需要更复杂的内容提取）
    const textContent = await readFileContent(file)

    // 调用后端API进行内容分析和知识库匹配
    const response: any = await api.post('/knowledge-bases/match', {
      fileName: file.name,
      fileContent: textContent,
      fileType: file.type
    })

    if (response.success && response.data?.knowledgeBaseId) {
      notify(`智能匹配到知识库: ${response.data.knowledgeBaseName}`, 'success')
      return response.data.knowledgeBaseId
    }

    return null
  } catch (error) {
    console.error('分析文件内容失败:', error)
    notify('智能分析失败，将使用默认知识库', 'warning')
    return null
  }
}

const uploadFile = async (file: File) => {
  notify(`正在上传文件: ${file.name}`, 'info')

  try {
    isUploading.value = true
    uploadProgress.value = 0

    // 构建上传路径：knowledge/当前路径
    // 如果在根目录，上传到 knowledge 根目录
    // 如果在子目录（如"个人知识库"），上传到 knowledge/个人知识库
    uploadProgress.value = 30
    const folder = currentPath.value.length > 0 
      ? `knowledge/${currentPath.value.join('/')}` 
      : 'knowledge'
    
    console.log('上传到文件夹:', folder, '当前路径:', currentPath.value, '原始文件名:', file.name)
    
    // 使用带详情的上传函数
    const result = await uploadToStorageWithDetails(file, folder)
    uploadProgress.value = 100
    
    console.log('文件已上传到腾讯云 COS:', result.url, 'key:', result.key)
    
    // 缓存原始文件名
    if (result.key) {
      cacheFileName(result.key, file.name)
      console.log('已缓存文件名映射:', result.key, '->', file.name)
    }
    
    // 刷新文件列表 - 始终从 COS 重新加载
    await loadFiles()
    
    notify(`文件上传成功: ${file.name}`, 'success')
  } catch (error) {
    console.error('Upload error:', error)
    notify(`文件上传失败: ${file.name}`, 'error')
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// 多选相关函数
const toggleFileSelection = (fileId: string, event?: Event) => {
  if (event) {
    event.stopPropagation()
  }
  
  if (selectedFiles.value.has(fileId)) {
    selectedFiles.value.delete(fileId)
  } else {
    selectedFiles.value.add(fileId)
  }
  
  // 更新全选状态
  const currentFileItems = currentItems.value.filter(item => item.type !== 'folder')
  isAllSelected.value = currentFileItems.length > 0 && currentFileItems.every(item => selectedFiles.value.has(item.id))
}

const toggleSelectAll = () => {
  const currentFileItems = currentItems.value.filter(item => item.type !== 'folder')
  
  if (isAllSelected.value) {
    // 取消全选
    currentFileItems.forEach(item => selectedFiles.value.delete(item.id))
    isAllSelected.value = false
  } else {
    // 全选
    currentFileItems.forEach(item => selectedFiles.value.add(item.id))
    isAllSelected.value = true
  }
}

const clearSelection = () => {
  selectedFiles.value.clear()
  isAllSelected.value = false
}

// Drag and Drop Functions
const handleDragStart = (event: DragEvent, item: FileItem) => {
  if (event.dataTransfer) {
    // 对于文件夹和文件都启用拖拽排序
    if (item.type === 'folder') {
      event.dataTransfer.effectAllowed = 'move'
      draggedItem.value = item
    } else if (item.type === 'file' || item.type === 'pdf') {
      event.dataTransfer.effectAllowed = 'copy'
      event.dataTransfer.setData('application/json', JSON.stringify(item))
      emit('drag-start', item)
    }
  }
}

const handleDragEnter = (event: DragEvent, item: FileItem) => {
  event.preventDefault()
  if (draggedItem.value && draggedItem.value.id !== item.id && item.type === 'folder') {
    dragOverItem.value = item.id
  }
}

const handleDragLeave = (event: DragEvent, item: FileItem) => {
  event.preventDefault()
  dragOverItem.value = null
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
}

const handleDrop = (event: DragEvent, item: FileItem) => {
  event.preventDefault()
  if (!draggedItem.value || draggedItem.value.id === item.id || item.type !== 'folder') {
    dragOverItem.value = null
    draggedItem.value = null
    return
  }

  // 执行拖拽排序逻辑
  const currentIndex = files.value.findIndex(f => f.id === draggedItem.value!.id)
  const targetIndex = files.value.findIndex(f => f.id === item.id)
  
  if (currentIndex !== -1 && targetIndex !== -1) {
    // 创建新的文件数组
    const newFiles = [...files.value]
    // 移除拖动的项目
    const [movedItem] = newFiles.splice(currentIndex, 1)
    // 插入到目标位置
    newFiles.splice(targetIndex, 0, movedItem)
    // 更新文件数组
    files.value = newFiles
    
    notify('文件夹已成功移动', 'success')
  }
  
  dragOverItem.value = null
  draggedItem.value = null
}

// 删除功能相关函数
const openDeleteDialog = (item: FileItem) => {
  // 检查是否为固定分类，固定分类不能删除
  if (isFixedCategory(item.path)) {
    notify('固定分类不能删除', 'warning')
    return
  }
  
  deleteItem.value = item
  showDeleteDialog.value = true
}

const confirmDelete = async () => {
  if (!deleteItem.value) return
  
  try {
    // 检查是否为固定分类，固定分类不能删除
    if (isFixedCategory(deleteItem.value.path)) {
      notify('固定分类不能删除', 'warning')
      return
    }
    
    // 从文件列表中移除项目
    files.value = files.value.filter(item => item.id !== deleteItem.value!.id)
    
    // 从服务器删除文件
    let deleteKey = '';
    // 如果文件的id是以'knowledge/'开头的COS key，直接使用id；否则，构建完整的COS路径
    if (deleteItem.value.id.startsWith('knowledge/')) {
      deleteKey = deleteItem.value.id;
    } else {
      // 如果是内部路径格式，转换为COS路径格式
      const pathParts = deleteItem.value.path.split('/').filter(Boolean);
      deleteKey = pathParts.length > 0 ? `knowledge/${pathParts.join('/')}` : deleteItem.value.id;
    }
    
    const response: any = await api.delete(`/cos/delete?key=${encodeURIComponent(deleteKey)}`);
    if (!response.success) {
      notify(`删除失败: ${response.message}`, 'error');
      return;
    }
    
    notify(`${deleteItem.value.name} 已成功删除`, 'success')
  } catch (error) {
    console.error('删除失败:', error)
    notify('删除失败', 'error')
  } finally {
    showDeleteDialog.value = false
    deleteItem.value = null
  }
}

const cancelDelete = () => {
  showDeleteDialog.value = false
  deleteItem.value = null
}

// 编辑功能相关函数
const openEditDialog = (item: FileItem) => {
  // 检查是否为固定分类，固定分类不能编辑
  if (isFixedCategory(item.path)) {
    notify('固定分类不能编辑', 'warning')
    return
  }
  
  editItem.value = { ...item }
  showEditDialog.value = true
}

const confirmEdit = async () => {
  if (!editItem.value) return
  
  try {
    // 检查是否为固定分类，固定分类不能编辑
    if (isFixedCategory(editItem.value.path)) {
      notify('固定分类不能编辑', 'warning')
      return
    }
    
    // 更新文件列表中的项目
    const index = files.value.findIndex(f => f.id === editItem.value!.id)
    if (index !== -1) {
      files.value = [...files.value]
      files.value[index] = editItem.value!
    }
    
    // 这里可以添加实际的后端更新API调用
    // await api.put(`/rustfs/update`, editItem.value)
    
    notify(`${editItem.value.name} 已成功更新`, 'success')
  } catch (error) {
    console.error('更新失败:', error)
    notify('更新失败', 'error')
  } finally {
    showEditDialog.value = false
    editItem.value = null
  }
}

const cancelEdit = () => {
  showEditDialog.value = false
  editItem.value = null
}

// 处理存储配置保存后的回调
const onStorageConfigSaved = () => {
  // 可以在这里执行一些后续操作，如刷新配置或显示通知
  console.log('存储配置已保存')
}
</script>

<template>
  <div class="flex flex-col h-full bg-white dark:bg-gray-900">
    <!-- 知识库主菜单目录 -->
    <div v-if="knowledgeBases && knowledgeBases.length > 0" class="p-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="kb in knowledgeBases"
          :key="kb.id"
          class="px-3 py-1 text-xs rounded-full transition-all"
          :class="{
            'bg-blue-500 text-white': selectedKnowledgeBase?.id === kb.id,
            'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600': selectedKnowledgeBase?.id !== kb.id
          }"
          @click="handleKnowledgeBaseSelect(kb)"
        >
          {{ kb.name }}
        </button>
      </div>
    </div>
    
    <!-- Header / Search and Upload -->
    <div class="p-3 border-b border-gray-200 dark:border-gray-800 space-y-2">
      <!-- Search Bar -->
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-sm">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索知识库文章、片段..."
          class="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
        >
      </div>

      <!-- Upload Section -->
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            :disabled="isUploading"
            @click="triggerFileUpload"
          >
            <span class="material-symbols-outlined text-xs">upload_file</span>
            上传文档
          </button>
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            :disabled="isUploading"
            @click="createNewFolder"
          >
            <span class="material-symbols-outlined text-xs">create_new_folder</span>
            创建文件夹
          </button>
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-all"
            :disabled="!previewItem || isLoadingContent"
            @click="handleFormatConvert"
          >
            <span class="material-symbols-outlined text-xs">auto_fix_high</span>
            一键格式转换
          </button>
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all"
            :disabled="selectedFiles.size === 0 || isUploading"
            @click="handleBatchConvert"
          >
            <span class="material-symbols-outlined text-xs">auto_awesome</span>
            批量转换
          </button>
          
          <!-- Storage Configuration Button -->
          <button
            class="flex items-center gap-1.5 text-xs px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all"
            @click="showStorageConfig = true"
          >
            <span class="material-symbols-outlined text-xs">settings</span>
            存储配置
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.md,.txt,.jpg,.jpeg,.png"
          class="hidden"
          @change="handleFileUpload"
        >

        <!-- Upload Progress Bar -->
        <div v-if="isUploading" class="flex-1 flex items-center gap-2">
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div
              class="bg-blue-500 h-1 rounded-full transition-all duration-300 ease-out"
              :style="{ width: `${uploadProgress}%` }"
            />
          </div>
          <span class="text-xs text-blue-600 dark:text-blue-400 whitespace-nowrap">{{ uploadProgress }}%</span>
        </div>
      </div>

      <!-- Breadcrumbs -->
      <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto no-scrollbar">
        <template v-for="(crumb, index) in breadcrumbs" :key="index">
          <span
            class="hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer whitespace-nowrap"
            :class="{ 'font-semibold text-gray-800 dark:text-gray-200': index === breadcrumbs.length - 1 }"
            @click="navigateToBreadcrumb(index)"
          >
            {{ crumb }}
          </span>
          <span v-if="index < breadcrumbs.length - 1" class="material-symbols-outlined text-[10px]">chevron_right</span>
        </template>
      </div>
    </div>

    <!-- Content List -->
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="currentItems.length === 0" class="flex flex-col items-center justify-center h-40 text-gray-400">
        <span class="material-symbols-outlined text-4xl mb-2">folder_off</span>
        <span class="text-xs">暂无内容</span>
      </div>

      <div class="space-y-1">
        <!-- 全选复选框 -->
        <div
          v-if="currentItems.some(item => item.type !== 'folder')"
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <input
            type="checkbox"
            :checked="isAllSelected"
            @change="toggleSelectAll"
            class="rounded text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          >
          <span class="text-xs text-gray-600 dark:text-gray-400 cursor-pointer" @click="toggleSelectAll">
            {{ isAllSelected ? '取消全选' : '全选' }}
          </span>
          <span class="text-xs text-gray-400 ml-auto">
            已选择 {{ selectedFiles.size }} 项
          </span>
        </div>
        
        <div
          v-for="item in currentItems"
          :key="item.id"
          draggable="true"
          class="group flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
          :class="{
            'ring-2 ring-blue-500 dark:ring-blue-400': dragOverItem === item.id,
            'opacity-50': draggedItem && draggedItem.id === item.id,
            'bg-blue-50 dark:bg-blue-900/20': selectedFiles.has(item.id) && item.type !== 'folder'
          }"
          @click="handleItemClick(item)"
          @dragstart="handleDragStart($event, item)"
          @dragenter="handleDragEnter($event, item)"
          @dragleave="handleDragLeave($event, item)"
          @dragover="handleDragOver($event)"
          @drop="handleDrop($event, item)"
        >
          <!-- 勾选框（仅文件显示） -->
          <input
            v-if="item.type !== 'folder'"
            type="checkbox"
            :checked="selectedFiles.has(item.id)"
            @click.stop="toggleFileSelection(item.id, $event)"
            class="rounded text-blue-500 focus:ring-blue-500 w-4 h-4 cursor-pointer flex-none"
          >
          <div v-else class="w-4 h-4 flex-none"></div>
          
          <!-- Icon with Color Coding for Knowledge Base Categories -->
          <div
            class="flex-none w-8 h-8 flex items-center justify-center rounded-lg overflow-hidden"
            :class="item.type === 'folder'
              ? (item.name === '基础知识库' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : item.name === '训练知识库' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : item.name === '多元知识库' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400')
              : (item.type === 'pdf' ? 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                : (item.type === 'image' ? 'bg-green-50 text-green-500 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'))"
          >
            <template v-if="item.type === 'image' && item.imageUrl">
              <img :src="item.imageUrl" class="w-full h-full object-cover" alt="preview">
            </template>
            <span v-else class="material-symbols-outlined text-sm">
              {{ item.type === 'folder'
                ? (item.name === '基础知识库' ? 'school'
                  : (item.name === '训练知识库' ? 'fitness_center'
                    : (item.name === '多元知识库' ? 'auto_awesome' : 'folder')))
                : (item.type === 'image' ? 'image'
                  : (item.type === 'pdf' ? 'picture_as_pdf' : 'description')) }}
            </span>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-0.5">
              <div class="flex items-center gap-1">
                <h4 class="text-xs font-medium text-gray-900 dark:text-gray-100 truncate pr-2" v-html="searchQuery ? item.name.replace(searchQuery, `<span class='text-sky-500'>${searchQuery}</span>`) : item.name" />
                <span v-if="isFixedCategory(item.path)" class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  固定分类
                </span>
              </div>
              <span class="text-[10px] text-gray-400 flex-none truncate">{{ item.updatedAt }}</span>
            </div>
            <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate">
              {{ item.type === 'folder' 
                ? (item.name === '基础知识库' ? '认知蒸馏形成的文本数据库，目的为解决精准问题'
                  : (item.name === '训练知识库' ? '行动聚焦形成的张量数据库，目的为解决适配问题'
                    : (item.name === '多元知识库' ? '对齐涌现形成的先验数据库，解决动态转化问题' : '文件夹')))
                : (item.type === 'image' ? '图片素材'
                  : (item.type === 'pdf' ? 'PDF 文档 • S3 存储' : '文档 • S3 存储')) }}
            </p>
          </div>
          
          <!-- 操作按钮 -->
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <!-- 编辑按钮 -->
            <button 
              @click.stop="openEditDialog(item)" 
              class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              :disabled="isFixedCategory(item.path)"
              :title="isFixedCategory(item.path) ? '固定分类不能编辑' : '编辑'"
            >
              <span class="material-symbols-outlined text-xs" :class="{ 'opacity-50 cursor-not-allowed': isFixedCategory(item.path) }">edit</span>
            </button>
            <!-- 删除按钮 -->
            <button 
              @click.stop="openDeleteDialog(item)" 
              class="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors"
              :disabled="isFixedCategory(item.path)"
              :title="isFixedCategory(item.path) ? '固定分类不能删除' : '删除'"
            >
              <span class="material-symbols-outlined text-xs" :class="{ 'opacity-50 cursor-not-allowed': isFixedCategory(item.path) }">delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Status -->
    <div class="flex-none px-3 py-1.5 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-400 flex justify-between items-center">
      <div class="flex items-center gap-1">
        <div class="w-1 h-1 rounded-full bg-green-500" />
        <span>S3 存储已连接</span>
      </div>
      <span>{{ currentItems.length }} 个项目</span>
    </div>
  </div>

  <!-- 内容预览对话框 -->
  <div v-if="showPreview" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
      <!-- 预览对话框头部 -->
      <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {{ previewItem?.name }}
        </h3>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="closePreview">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- 文件信息栏 -->
      <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div class="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span class="text-gray-500 dark:text-gray-400">文件类型:</span>
            <span class="text-gray-900 dark:text-gray-100">text/plain</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">文件大小:</span>
            <span class="text-gray-900 dark:text-gray-100">{{ fileStats.fileSize ? formatFileSize(fileStats.fileSize) : '未知' }}</span>
          </div>
          <div>
            <span class="text-gray-500 dark:text-gray-400">字数统计:</span>
            <span class="text-gray-900 dark:text-gray-100">{{ fileStats.wordCount }}字</span>
          </div>
        </div>
      </div>

      <!-- 预览内容区域 -->
      <div class="flex-1 p-4 overflow-y-auto">
        <div v-if="isLoadingContent" class="flex items-center justify-center h-40">
          <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
        </div>

        <!-- 原文预览 -->
        <div v-else class="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-200">
          {{ previewContent }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          创建时间: {{ previewItem?.updatedAt || '未知' }}
        </div>
        <div class="flex gap-2">
          <button class="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" @click="closePreview">
            关闭
          </button>
          <button class="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors" @click="copyContent">
            <span class="material-symbols-outlined text-xs">content_copy</span> 复制内容
          </button>
        </div>
      </div>
    </div>
  </div>
  
  <!-- 删除确认对话框 -->
  <div v-if="showDeleteDialog" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm">
      <!-- 对话框头部 -->
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">确认删除</h3>
        <button @click="cancelDelete" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      
      <!-- 对话框内容 -->
      <div class="px-4 py-4">
        <p class="text-sm text-gray-700 dark:text-gray-300">
          您确定要删除 <span class="font-medium text-gray-900 dark:text-gray-100">{{ deleteItem?.name }}</span> 吗？
        </p>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          此操作不可恢复
        </p>
      </div>
      
      <!-- 对话框底部 -->
      <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
        <button @click="cancelDelete" class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          取消
        </button>
        <button @click="confirmDelete" class="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
          确认删除
        </button>
      </div>
    </div>
  </div>
  
  <!-- 编辑对话框 -->
  <div v-if="showEditDialog" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-sm">
      <!-- 对话框头部 -->
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">编辑项目</h3>
        <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      
      <!-- 对话框内容 -->
      <div class="px-4 py-4">
        <!-- 名称输入 -->
        <div class="mb-4">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">名称</label>
          <input 
            v-if="editItem" 
            v-model="editItem.name" 
            type="text" 
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="输入名称"
          />
        </div>
        
        <!-- 类型选择 -->
        <div v-if="editItem && editItem.type === 'folder'" class="mb-4">
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">类型</label>
          <select 
            v-model="editItem.type" 
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="folder">文件夹</option>
            <option value="基础知识库">基础知识库</option>
            <option value="训练知识库">训练知识库</option>
            <option value="多元知识库">多元知识库</option>
          </select>
        </div>
      </div>
      
      <!-- 对话框底部 -->
      <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
        <button @click="cancelEdit" class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          取消
        </button>
        <button @click="confirmEdit" class="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          保存更改
        </button>
      </div>
    </div>
  </div>
  
  <!-- Storage Configuration Dialog -->
  <StorageConfigDialog
    v-if="showStorageConfig"
    @close="showStorageConfig = false"
    @saved="onStorageConfigSaved"
  />
</template>
