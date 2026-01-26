// 文件大小格式化
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 文本分块
export const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const chunks = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.substring(start, end))
    start += chunkSize - overlap
  }

  return chunks
}

// 计算相关性分数
export const calculateRelevance = (query: string, text: string): number => {
  const queryWords = query.toLowerCase().split(/\s+/)
  const textLower = text.toLowerCase()
  let score = 0
  
  queryWords.forEach(word => {
    if (textLower.includes(word)) {
      score += 1
    }
  })
  
  return score / queryWords.length
}

// 生成唯一ID
export const generateId = (prefix: string = ''): string => {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// 复制到剪贴板
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.select()
    
    try {
      document.execCommand('copy')
      return true
    } catch (err) {
      return false
    } finally {
      document.body.removeChild(textArea)
    }
  }
}

// 下载文件
export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// 读取文件内容
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = (e) => reject(e)
    reader.readAsText(file)
  })
}

// 验证JSON格式
export const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

// 格式化时间戳
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 节点配置验证
export const validateNodeConfig = (nodeType: string, config: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = []
  
  switch (nodeType) {
    case 'llm-deepseek':
    case 'llm-gemini':
      if (!config.systemPrompt) {
        errors.push('系统提示词不能为空')
      }
      if (config.temperature && (config.temperature < 0 || config.temperature > 2)) {
        errors.push('温度值必须在0-2之间')
      }
      break
      
    case 'code-js':
      if (!config.code) {
        errors.push('JavaScript代码不能为空')
      }
      break
      
    case 'input-text':
      if (!config.placeholder) {
        errors.push('占位符文本不能为空')
      }
      break
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

// 生成默认节点名称
export const generateNodeName = (nodeType: string): string => {
  const typeMap: Record<string, string> = {
    'llm-deepseek': 'DeepSeek V3',
    'llm-gemini': 'Gemini Flash',
    'input-text': '文本输入',
    'output-text': '文本输出',
    'rag-upload': '知识库上传',
    'rag-query': '知识检索',
    'code-js': 'JavaScript代码',
    'code-cmd': '命令执行',
    'condition': '条件判断',
    'memory': '对话记忆'
  }
  
  return typeMap[nodeType] || nodeType
}