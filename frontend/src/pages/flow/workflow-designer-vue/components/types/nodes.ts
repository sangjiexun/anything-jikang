import type { NodeType } from '../../../../../../lib/types/flow/workflow'

export const NODE_TYPES: Record<string, NodeType> = {
  // LLM节点
  'llm-deepseek': {
    type: 'llm',
    title: 'DeepSeek V3',
    description: 'DeepSeek大语言模型，用于文本生成和对话',
    icon: '🧠',
    color: '#6366f1',
    inputs: ['text'],
    outputs: ['text'],
    config: {
      model: 'deepseek-v3',
      systemPrompt: '你是一个有帮助的AI助手。',
      temperature: 0.7,
      maxTokens: 2048
    }
  },
  'llm-gemini': {
    type: 'llm',
    title: 'Gemini Flash',
    description: 'Google Gemini Flash大语言模型',
    icon: '💎',
    color: '#10b981',
    inputs: ['text'],
    outputs: ['text'],
    config: {
      model: 'gemini-2.5-flash-all',
      systemPrompt: '你是一个有帮助的AI助手。',
      temperature: 0.7,
      maxTokens: 2048
    }
  },

  // 输入输出节点
  'input-text': {
    type: 'input',
    title: '文本输入',
    description: '接收用户文本输入',
    icon: '📝',
    color: '#f59e0b',
    inputs: [],
    outputs: ['text'],
    config: {
      placeholder: '请输入文本...',
      defaultValue: ''
    }
  },
  'output-text': {
    type: 'output',
    title: '文本输出',
    description: '输出文本结果',
    icon: '📄',
    color: '#8b5cf6',
    inputs: ['text'],
    outputs: [],
    config: {
      format: 'text'
    }
  },
  'output-save': {
    type: 'output',
    title: '保存文件',
    description: '将结果保存到文件',
    icon: '💾',
    color: '#ec4899',
    inputs: ['data'],
    outputs: [],
    config: {
      filename: 'result',
      format: 'json'
    }
  },

  // RAG节点
  'rag-upload': {
    type: 'rag',
    title: '知识库上传',
    description: '上传文档创建知识库',
    icon: '??',
    color: '#06b6d4',
    inputs: ['documents'],
    outputs: ['knowledge'],
    config: {
      chunkSize: 500,
      chunkOverlap: 50
    }
  },
  'rag-query': {
    type: 'rag',
    title: '知识检索',
    description: '从知识库检索相关信息',
    icon: '🔍',
    color: '#0891b2',
    inputs: ['query', 'knowledge'],
    outputs: ['context'],
    config: {
      topK: 3,
      threshold: 0.7
    }
  },

  // 代码节点
  'code-js': {
    type: 'code',
    title: 'JavaScript',
    description: '执行JavaScript代码',
    icon: '⚡',
    color: '#eab308',
    inputs: ['data'],
    outputs: ['result'],
    config: {
      code: '// JavaScript代码\nreturn input;'
    }
  },
  'code-cmd': {
    type: 'cmd',
    title: '命令执行',
    description: '执行系统命令',
    icon: '🖥️',
    color: '#84cc16',
    inputs: ['command'],
    outputs: ['output'],
    config: {
      command: ''
    }
  },

  // 算法节点
  'algo-latex-ai': {
    type: 'algo',
    title: 'LaTeX公式生成',
    description: 'AI生成LaTeX数学公式',
    icon: '🧮',
    color: '#f97316',
    inputs: ['prompt'],
    outputs: ['latex'],
    config: {
      model: 'deepseek-v3',
      promptTemplate: '请生成以下数学概念的LaTeX公式：${input}'
    }
  },
  'algo-formula': {
    type: 'algo',
    title: '公式计算',
    description: '数学公式计算与验证',
    icon: '🧮',
    color: '#ea580c',
    inputs: ['formula'],
    outputs: ['result'],
    config: {
      model: 'deepseek-v3',
      promptTemplate: '请计算以下数学公式：${output}'
    }
  },
  'algo-chart': {
    type: 'algo',
    title: '图表生成',
    description: 'AI智能图表生成',
    icon: '📊',
    color: '#dc2626',
    inputs: ['data'],
    outputs: ['chart'],
    config: {
      library: 'echarts',
      chartType: 'bar',
      style: 'modern',
      useAI: 'false'
    }
  },

  // 视觉节点
  'algo-threejs': {
    type: 'visual',
    title: 'Three.js 3D',
    description: 'Three.js 3D可视化',
    icon: '??',
    color: '#7c3aed',
    inputs: ['code'],
    outputs: ['visualization'],
    config: {
      code: '// Three.js 3D代码'
    }
  },
  'algo-p5js': {
    type: 'visual',
    title: 'p5.js 物理',
    description: 'p5.js物理模拟',
    icon: '🎨',
    color: '#c026d3',
    inputs: ['code'],
    outputs: ['animation'],
    config: {
      code: '// p5.js 代码'
    }
  },

  // 逻辑节点
  'condition': {
    type: 'condition',
    title: '条件判断',
    description: '基于条件进行分支',
    icon: '🔀',
    color: '#059669',
    inputs: ['data'],
    outputs: ['true', 'false'],
    config: {
      condition: 'input !== null'
    }
  },

  // 记忆节点
  'memory': {
    type: 'memory',
    title: '对话记忆',
    description: '管理对话历史和上下文',
    icon: '🧠',
    color: '#7c2d12',
    inputs: ['message'],
    outputs: ['history'],
    config: {
      maxMessages: 10
    }
  },

  // 后处理节点
  'post-web': {
    type: 'post',
    title: '网页生成',
    description: '生成HTML网页',
    icon: '🌐',
    color: '#0284c7',
    inputs: ['content'],
    outputs: ['html'],
    config: {
      promptTemplate: '请将内容整理成网页',
      saveLocal: false
    }
  },
  'post-ppt': {
    type: 'post',
    title: 'PPT生成',
    description: '生成演示文稿',
    icon: '📽️',
    color: '#0369a1',
    inputs: ['content'],
    outputs: ['ppt'],
    config: {}
  },
  'post-pdf': {
    type: 'post',
    title: 'PDF生成',
    description: '生成PDF文档',
    icon: '📑',
    color: '#075985',
    inputs: ['content'],
    outputs: ['pdf'],
    config: {}
  },

  // NLP节点
  'nlp-semantic': {
    type: 'llm',
    title: '语义分析',
    description: '自然语言处理与语义分析',
    icon: '🔤',
    color: '#64748b',
    inputs: ['text'],
    outputs: ['analysis'],
    config: {
      model: 'deepseek-v3',
      analysisType: 'comprehensive'
    }
  },

  // 人格分析节点
  'personality-analysis': {
    type: 'llm',
    title: '人格分析',
    description: '深度人格画像分析',
    icon: '👤',
    color: '#475569',
    inputs: ['target'],
    outputs: ['profile'],
    config: {
      model: 'deepseek-v3'
    }
  },

  // Markdown编辑器
  'editor-markdown': {
    type: 'input',
    title: 'Markdown编辑器',
    description: '支持LaTeX的Markdown编辑器',
    icon: '📝',
    color: '#334155',
    inputs: ['content'],
    outputs: ['html'],
    config: {
      content: '# Markdown内容'
    }
  },

  // 图片生成
  'image-generation': {
    type: 'visual',
    title: '图片生成',
    description: 'AI图片生成',
    icon: '🖼️',
    color: '#be123c',
    inputs: ['prompt'],
    outputs: ['images'],
    config: {
      model: 'jimeng-4.0',
      size: '1024x1024',
      n: 4
    }
  },

  // LLM过滤器
  'llm-filter': {
    type: 'filter',
    title: 'LLM过滤器',
    description: '使用LLM进行文本过滤和处理',
    icon: '🔧',
    color: '#991b1b',
    inputs: ['text'],
    outputs: ['filtered'],
    config: {
      mode: 'ai',
      filterType: 'clean',
      aiPrompt: '请清洗以下文本'
    }
  }
}

// 获取节点类别
export const getNodeCategories = () => {
  const categories = {
    'LLM模型': Object.entries(NODE_TYPES)
      .filter(([_, node]) => node.type === 'llm')
      .map(([id, node]) => ({ id, ...node })),
    '输入输出': Object.entries(NODE_TYPES)
      .filter(([_, node]) => ['input', 'output'].includes(node.type))
      .map(([id, node]) => ({ id, ...node })),
    '知识库RAG': Object.entries(NODE_TYPES)
      .filter(([_, node]) => node.type === 'rag')
      .map(([id, node]) => ({ id, ...node })),
    '代码执行': Object.entries(NODE_TYPES)
      .filter(([_, node]) => ['code', 'cmd'].includes(node.type))
      .map(([id, node]) => ({ id, ...node })),
    '算法工具': Object.entries(NODE_TYPES)
      .filter(([_, node]) => node.type === 'algo')
      .map(([id, node]) => ({ id, ...node })),
    '可视化': Object.entries(NODE_TYPES)
      .filter(([_, node]) => node.type === 'visual')
      .map(([id, node]) => ({ id, ...node })),
    '逻辑控制': Object.entries(NODE_TYPES)
      .filter(([_, node]) => ['condition', 'memory'].includes(node.type))
      .map(([id, node]) => ({ id, ...node })),
    '后处理': Object.entries(NODE_TYPES)
      .filter(([_, node]) => node.type === 'post')
      .map(([id, node]) => ({ id, ...node })),
    '文本处理': Object.entries(NODE_TYPES)
      .filter(([_, node]) => ['nlp-semantic', 'personality-analysis', 'llm-filter'].includes(id))
      .map(([id, node]) => ({ id, ...node }))
  }

  return categories
}