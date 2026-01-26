<script lang="ts" setup>
// 导入 SlideVerify 组件
import SlideVerify from '~/components/SlideVerify.vue'
import { onMounted } from 'vue'

definePageMeta({
  layout: false,
  middleware: (to, from) => {
    // 在 Electron 环境中使用 electron 布局
    if (import.meta.client && (window as any).isElectron) {
      to.meta.layout = 'electron'
    }
  }
})

// 设置页面标题
useSeoMeta({
  title: '极康AI - 登录',
  description: '极康AI管理系统登录页面',
  robots: 'noindex, nofollow'
})

useHead({
  title: '极康AI - 登录',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' }
  ],
  script: [
    // 优化：使用 preload 和 async 加载外部脚本，不阻塞渲染
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      async: true,
      defer: true
    },
    {
      src: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.min.js',
      async: true,
      defer: true
    }
  ],
  link: [
    // 预连接外部资源
    { rel: 'preconnect', href: 'https://cdnjs.cloudflare.com', crossorigin: 'anonymous' },
    { rel: 'dns-prefetch', href: 'https://cdnjs.cloudflare.com' }
  ]
})

const { t } = useI18n()
const { login, loginByPhone, sendPhoneCode, isAuthenticated, user, initAuth } = useAuth()
const router = useRouter()
const toast = useToast()
const colorMode = useColorMode()

// 页面加载时检查认证状态
onMounted(async () => {
  // 初始化认证状态
  await initAuth(true)
  
  // 如果已认证，跳转到相应页面
  if (isAuthenticated.value) {
    const userRoles = user.value?.roles || []
    const hasCreatorRole = userRoles.includes('creator')
    const hasAdminRole = userRoles.includes('admin')
    
    if (hasCreatorRole) {
      await router.push('/creator/workstation')
    } else if (hasAdminRole) {
      await router.push('/admin/dashboard')
    } else {
      await router.push('/')
    }
  }
})

const loginType = ref<'password' | 'phone'>('password')
const loading = ref(false)
const showPassword = ref(false)
const slideVerifyRef = ref<any>()
const slideVerifyPhoneRef = ref<any>()
const isVerified = ref(false)
const isPhoneVerified = ref(false)
const codeCountdown = ref(0)
const sendingCode = ref(false)

// 轮播文案 - 只保留三条中文
const carouselTexts = [
  {
    zh: '新一代可信可用可交换的智能体',
    en: 'Trustworthy, Usable & Exchangeable AI'
  },
  {
    zh: '我们不生产垃圾数据，只创造极致信用',
    en: 'No Garbage Data, Only Ultimate Credit'
  },
  {
    zh: '用数据讲好中国故事',
    en: 'Tell China\'s Story with Data'
  }
]
const currentTextIndex = ref(0)
const displayedText = ref('')
const displayedEnText = ref('')
const textContainerRef = ref<HTMLElement | null>(null)
const enTextRef = ref<HTMLElement | null>(null)
const isTransitioning = ref(false)
const zhFontSize = ref(140) // 中文基础字体大小
const enFontSize = ref(24) // 英文基础字体大小

// 密码登录
const passwordState = reactive({
  username: '',
  password: '',
  userType: 'creator',
  remember: false
})

// 手机号登录
const phoneState = reactive({
  phone: '',
  code: '',
  userType: 'creator'
})

// 发送验证码（需要先完成滑块验证）
async function handleSendCode() {
  if (!phoneState.phone) {
    toast.add({
      title: '提示',
      description: '请输入手机号',
      color: 'warning'
    })
    return
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(phoneState.phone)) {
    toast.add({
      title: '提示',
      description: '手机号格式不正确',
      color: 'warning'
    })
    return
  }

  // 需要先完成滑块验证
  if (!isPhoneVerified.value) {
    toast.add({
      title: '提示',
      description: '请先完成滑块验证',
      color: 'warning'
    })
    return
  }

  sendingCode.value = true
  try {
    const response = await sendPhoneCode(phoneState.phone)

    toast.add({
      title: '成功',
      description: response.message || '验证码已发送',
      color: 'success'
    })

    // 开发环境显示验证码
    if (response.code) {
      console.log(`[开发环境] 验证码: ${response.code}`)
      toast.add({
        title: '开发环境提示',
        description: `验证码: ${response.code}`,
        color: 'info',
        timeout: 10000
      })
    }

    // 开始倒计时
    codeCountdown.value = 60
    const timer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0) {
        clearInterval(timer)
      }
    }, 1000)
  } catch (error: any) {
    let errorMessage = '发送验证码失败'
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    }

    toast.add({
      title: '错误',
      description: errorMessage,
      color: 'error'
    })
    // 验证失败后重置滑块
    isPhoneVerified.value = false
    slideVerifyPhoneRef.value?.reset()
  } finally {
    sendingCode.value = false
  }
}

// 滑块验证成功
function onVerifySuccess() {
  isVerified.value = true
}

// 手机号登录滑块验证成功
function onVerifyPhoneSuccess() {
  isPhoneVerified.value = true
}

// 密码登录
async function handlePasswordLogin() {
  if (!passwordState.username || !passwordState.password) {
    toast.add({
      title: t('login.errorTitle'),
      description: t('login.pleaseEnterUsernameAndPassword'),
      color: 'error'
    })
    return
  }

  if (!isVerified.value) {
    toast.add({
      title: '提示',
      description: '请完成滑块验证',
      color: 'warning'
    })
    return
  }

  loading.value = true
  try {
    const response = await login({
      username: passwordState.username,
      password: passwordState.password,
      userType: passwordState.userType,
      remember: passwordState.remember
    })

    console.log('Login successful:', response)

    // 显示成功提示
    toast.add({
      title: t('login.successTitle'),
      description: t('login.success'),
      color: 'success'
    })

    // 等待状态更新后再跳转
    await nextTick()

    // 根据用户选择的类型和实际角色决定跳转目标
    const userRoles = response.user?.roles || []
    const hasCreatorRole = userRoles.includes('creator')
    const hasAdminRole = userRoles.includes('admin')

    // 如果用户选择的是"创作者"，优先跳转到创作者工作台
    if (passwordState.userType === 'creator') {
      if (hasCreatorRole) {
        await router.push('/creator/workstation')
      } else {
        // 如果没有创作者角色，提示用户，不进行跳转
        toast.add({
          title: '权限不足',
          description: '您还没有创作者权限，请联系管理员获取相应权限',
          color: 'error'
        })
        return // 停止执行，不跳转
      }
    } else {
      // 如果用户选择的是"管理员"，检查管理员权限
      if (hasAdminRole) {
        await router.push('/admin/dashboard')
      } else {
        // 如果没有管理员权限，提示用户，不进行跳转
        toast.add({
          title: '权限不足',
          description: '您还没有管理员权限，请联系管理员获取相应权限',
          color: 'error'
        })
        return // 停止执行，不跳转
      }
    }
  } catch (error: any) {
    // 处理错误消息 - 支持多种错误格式
    let errorMessage = t('login.loginFailed')
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.data?.error) {
      errorMessage = error.data.error
    }

    toast.add({
      title: t('login.errorTitle'),
      description: errorMessage,
      color: 'error'
    })
    // 验证失败后重置滑块
    isVerified.value = false
    slideVerifyRef.value?.reset()
  } finally {
    loading.value = false
  }
}

// 监听手机号变化，重置验证状态
watch(() => phoneState.phone, () => {
  isPhoneVerified.value = false
  slideVerifyPhoneRef.value?.reset()
})

// 手机号登录
async function handlePhoneLogin() {
  if (!phoneState.phone || !phoneState.code) {
    toast.add({
      title: t('login.errorTitle'),
      description: '请输入手机号和验证码',
      color: 'error'
    })
    return
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(phoneState.phone)) {
    toast.add({
      title: '提示',
      description: '手机号格式不正确',
      color: 'warning'
    })
    return
  }

  // 验证验证码格式
  if (!/^\d{6}$/.test(phoneState.code)) {
    toast.add({
      title: '提示',
      description: '验证码格式不正确（6位数字）',
      color: 'warning'
    })
    return
  }

  loading.value = true
  try {
    const response = await loginByPhone({
      phone: phoneState.phone,
      code: phoneState.code,
      userType: phoneState.userType
    })

    console.log('Phone login successful:', response)

    // 显示成功提示
    toast.add({
      title: t('login.successTitle'),
      description: t('login.success'),
      color: 'success'
    })

    // 等待状态更新后再跳转
    await nextTick()

    // 根据用户选择的类型和实际角色决定跳转目标
    const userRoles = response.user?.roles || []
    const hasCreatorRole = userRoles.includes('creator')
    const hasAdminRole = userRoles.includes('admin')

    // 如果用户选择的是"创作者"，优先跳转到创作者工作台
    if (phoneState.userType === 'creator') {
      if (hasCreatorRole) {
        await router.push('/creator/workstation')
      } else {
        // 如果没有创作者角色，提示用户，不进行跳转
        toast.add({
          title: '权限不足',
          description: '您还没有创作者权限，请联系管理员获取相应权限',
          color: 'error'
        })
        return // 停止执行，不跳转
      }
    } else {
      // 如果用户选择的是"管理员"，检查管理员权限
      if (hasAdminRole) {
        await router.push('/admin/dashboard')
      } else {
        // 如果没有管理员权限，提示用户，不进行跳转
        toast.add({
          title: '权限不足',
          description: '您还没有管理员权限，请联系管理员获取相应权限',
          color: 'error'
        })
        return // 停止执行，不跳转
      }
    }
  } catch (error: any) {
    // 处理错误消息 - 支持多种错误格式
    let errorMessage = t('login.loginFailed')
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.data?.error) {
      errorMessage = error.data.error
    }

    toast.add({
      title: t('login.errorTitle'),
      description: errorMessage,
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

// 微信登录
function handleWechatLogin() {
  toast.add({
    title: '提示',
    description: '微信登录功能开发中',
    color: 'warning'
  })
}

// GitHub登录
function handleGitHubLogin() {
  toast.add({
    title: '提示',
    description: 'GitHub登录功能开发中',
    color: 'warning'
  })
}

// Google登录
function handleGoogleLogin() {
  toast.add({
    title: '提示',
    description: 'Google登录功能开发中',
    color: 'warning'
  })
}

// 切换主题
function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// 背景特效
const threeCanvasRef = ref<HTMLCanvasElement | null>(null)
const p5CanvasRef = ref<HTMLDivElement | null>(null)

// 动画帧ID管理
let animationFrameId: number | null = null
let threeAnimationId: number | null = null
let p5Instance: any = null

// resize事件处理（优化）
let resizeTimer: NodeJS.Timeout | null = null
const handleResizeOptimized = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    // 重置字体大小为基础值，然后重新计算
    zhFontSize.value = 140
    enFontSize.value = 24
    adjustTextSize(true)
  }, 150)
}

onMounted(() => {
  if (import.meta.client) {
    initThreeJS()
    initP5JS()
    window.addEventListener('resize', handleResize)
    startTextCarousel()
    // 延迟调整大小，确保DOM已渲染
    nextTick(() => {
      // 重置字体大小为基础值
      zhFontSize.value = 140
      enFontSize.value = 24
      adjustTextSize(true)
    })
    // 使用节流优化resize事件
    window.addEventListener('resize', handleResizeOptimized)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('resize', handleResizeOptimized)
  if (carouselTimer) {
    clearTimeout(carouselTimer)
    carouselTimer = null
  }
  if (adjustTimer) {
    clearTimeout(adjustTimer)
    adjustTimer = null
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  // 清理requestAnimationFrame
  if (animationFrameId !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (threeAnimationId !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
    cancelAnimationFrame(threeAnimationId)
    threeAnimationId = null
  }
  // 清理p5.js实例
  if (p5Instance && typeof p5Instance.remove === 'function') {
    p5Instance.remove()
    p5Instance = null
  }
})

// 动态调整文字大小，确保不换行（优化：减少调用频率）
let adjustTimer: NodeJS.Timeout | null = null
let lastAdjustTime = 0
const ADJUST_THROTTLE = 200 // 节流时间

function adjustTextSize(force = false) {
  const now = Date.now()
  if (!force && now - lastAdjustTime < ADJUST_THROTTLE) {
    return
  }
  lastAdjustTime = now

  if (adjustTimer) {
    clearTimeout(adjustTimer)
  }
  adjustTimer = setTimeout(() => {
    if (!import.meta.client) return

    requestAnimationFrame(() => {
      // 调整中文文字大小 - 自适应缩放保证完整显示且不换行
      if (textContainerRef.value) {
        const container = textContainerRef.value
        // 获取父容器（左侧面板）的宽度，作为可用宽度基准
        const parentContainer = container.parentElement
        const containerWidth = parentContainer ? parentContainer.offsetWidth : container.offsetWidth
        const textElement = container.querySelector('.carousel-text') as HTMLElement

        if (textElement && containerWidth > 0) {
          const currentItem = carouselTexts[currentTextIndex.value]
          const fullText = currentItem?.zh || ''

          // 使用临时元素测量完整文本宽度
          const tempSpan = document.createElement('span')
          tempSpan.style.position = 'absolute'
          tempSpan.style.visibility = 'hidden'
          tempSpan.style.whiteSpace = 'nowrap'
          tempSpan.style.fontSize = `${zhFontSize.value}px`
          tempSpan.style.fontFamily = getComputedStyle(textElement).fontFamily
          tempSpan.style.fontWeight = getComputedStyle(textElement).fontWeight
          tempSpan.style.letterSpacing = getComputedStyle(textElement).letterSpacing
          tempSpan.textContent = fullText
          document.body.appendChild(tempSpan)
          const textWidth = tempSpan.offsetWidth
          document.body.removeChild(tempSpan)

          // 如果文字宽度超过父容器，计算缩放比例
          // 考虑容器的padding (40px * 2) 和向右移动的10px (margin-left)
          const containerPadding = 80 // 左右各40px
          const rightOffset = 70 // 向右移动70px (margin-left)
          const availableWidth = containerWidth - containerPadding - rightOffset

          if (textWidth > availableWidth) {
            // 计算需要的字体大小
            const scale = availableWidth / textWidth
            zhFontSize.value = Math.max(zhFontSize.value * scale, 40) // 最小40px
          } else {
            // 恢复基础字体大小，让文字可以向右延展
            zhFontSize.value = 140
          }
        }
      }

      // 调整英文文字大小 - 自适应缩放保证完整显示且不换行
      if (enTextRef.value && textContainerRef.value) {
        // 获取父容器（左侧面板）的宽度，作为可用宽度基准
        const parentContainer = textContainerRef.value.parentElement
        const containerWidth = parentContainer ? parentContainer.offsetWidth : textContainerRef.value.offsetWidth

        if (containerWidth > 0) {
          const currentItem = carouselTexts[currentTextIndex.value]
          const fullEnText = currentItem?.en || ''

          // 使用临时元素测量
          const tempSpan = document.createElement('span')
          tempSpan.style.position = 'absolute'
          tempSpan.style.visibility = 'hidden'
          tempSpan.style.whiteSpace = 'nowrap'
          tempSpan.style.fontSize = `${enFontSize.value}px`
          tempSpan.style.fontFamily = getComputedStyle(enTextRef.value).fontFamily
          tempSpan.style.fontWeight = getComputedStyle(enTextRef.value).fontWeight
          tempSpan.style.letterSpacing = getComputedStyle(enTextRef.value).letterSpacing
          tempSpan.textContent = fullEnText
          document.body.appendChild(tempSpan)
          const textWidth = tempSpan.offsetWidth
          document.body.removeChild(tempSpan)

          // 如果文字宽度超过父容器，计算缩放比例
          // 考虑容器的padding (40px * 2) 和向右移动的10px (margin-left)
          const containerPadding = 80 // 左右各40px
          const rightOffset = 70 // 向右移动70px (margin-left)
          const availableWidth = containerWidth - containerPadding - rightOffset

          if (textWidth > availableWidth) {
            // 计算需要的字体大小
            const scale = availableWidth / textWidth
            enFontSize.value = Math.max(enFontSize.value * scale, 12) // 最小12px
          } else {
            // 恢复基础字体大小，让文字可以向右延展
            enFontSize.value = 24
          }
        }
      }
    })
  }, 50)
}

// 只在文字完整显示或窗口大小变化时调整
watch([currentTextIndex], () => {
  adjustTextSize(true)
})

watch([displayedText, displayedEnText], () => {
  // 文字更新时调整大小（翻页效果下文字是完整的）
  if (!isTransitioning.value) {
    adjustTextSize(true)
  }
})

// 轮播文字动画 - 翻页效果
let carouselTimer: NodeJS.Timeout | null = null

function startTextCarousel() {
  let currentIndex = 0
  const DISPLAY_DURATION = 4000 // 每个文案显示4秒
  const TRANSITION_DURATION = 600 // 翻页过渡时间600ms

  function showNextText() {
    // 设置过渡状态
    isTransitioning.value = true

    // 等待过渡动画完成
    setTimeout(() => {
      // 切换到下一个文案
      currentIndex = (currentIndex + 1) % carouselTexts.length
      currentTextIndex.value = currentIndex

      const currentItem = carouselTexts[currentIndex]
      displayedText.value = currentItem.zh
      displayedEnText.value = currentItem.en

      // 重置字体大小为基础值
      zhFontSize.value = 140
      enFontSize.value = 24

      // 调整文字大小
      adjustTextSize(true)

      // 结束过渡状态
      setTimeout(() => {
        isTransitioning.value = false
      }, 50)

      // 设置下一个切换
      carouselTimer = setTimeout(showNextText, DISPLAY_DURATION)
    }, TRANSITION_DURATION)
  }

  // 初始化第一个文案
  const firstItem = carouselTexts[0]
  displayedText.value = firstItem.zh
  displayedEnText.value = firstItem.en
  // 重置字体大小为基础值
  zhFontSize.value = 140
  enFontSize.value = 24
  adjustTextSize(true)

  // 延迟开始轮播
  carouselTimer = setTimeout(showNextText, DISPLAY_DURATION)
}

function handleResize() {
  if (import.meta.client) {
    initThreeJS()
  }
}

// THREE.js - 墨绿+金线地形
function initThreeJS() {
  if (!import.meta.client || !threeCanvasRef.value || typeof (window as any).THREE === 'undefined') {
    // 如果 THREE.js 未加载，延迟重试
    setTimeout(() => {
      if (typeof (window as any).THREE !== 'undefined') {
        initThreeJS()
      }
    }, 100)
    return
  }

  const THREE = (window as any).THREE
  const canvas = threeCanvasRef.value
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setSize(window.innerWidth, window.innerHeight)

  const geo = new THREE.PlaneGeometry(120, 120, 60, 60)
  const mat = new THREE.MeshPhongMaterial({
    color: 0x0a1c15, // 墨绿
    wireframe: true,
    transparent: true,
    opacity: 0.3,
    emissive: 0xe6d5b8, // 金属金边缘发光
    emissiveIntensity: 0.2
  })
  const terrain = new THREE.Mesh(geo, mat)
  terrain.rotation.x = -Math.PI / 2.5
  scene.add(terrain)

  const light1 = new THREE.PointLight(0xe6d5b8, 1, 100)
  light1.position.set(0, 20, 10)
  scene.add(light1)

  function animateThree() {
    threeAnimationId = requestAnimationFrame(animateThree)
    const time = Date.now() * 0.0003
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = Math.sin(x * 0.2 + time) * Math.cos(y * 0.2 + time) * 2.5
      pos.setZ(i, z)
    }
    pos.needsUpdate = true
    terrain.rotation.z += 0.001
    renderer.render(scene, camera)
  }
  camera.position.set(0, 15, 40)
  animateThree()
}

// p5.js - 金色HUD粒子
function initP5JS() {
  if (!import.meta.client || !p5CanvasRef.value || typeof (window as any).p5 === 'undefined') {
    // 如果 p5.js 未加载，延迟重试
    setTimeout(() => {
      if (typeof (window as any).p5 !== 'undefined') {
        initP5JS()
      }
    }, 100)
    return
  }

  const p5 = (window as any).p5
  p5Instance = new p5((p: any) => {
    const particles: any[] = []
    p.setup = () => {
      const canvas = p.createCanvas(p.windowWidth, p.windowHeight)
      canvas.parent(p5CanvasRef.value)
      for (let i = 0; i < 50; i++) {
        particles.push(new Particle(p))
      }
    }
    p.draw = () => {
      p.clear()
      particles.forEach((pt: any) => {
        pt.update()
        pt.show()
      })
    }
    class Particle {
      p: any
      pos: any
      vel: any
      constructor(p: any) {
        this.p = p
        this.pos = p.createVector(p.random(p.width), p.random(p.height))
        this.vel = p.createVector(p.random(-0.5, 0.5), p.random(-0.5, 0.5))
      }

      update() {
        this.pos.add(this.vel)
        if (this.pos.x > this.p.width) this.pos.x = 0
        if (this.pos.y > this.p.height) this.pos.y = 0
      }

      show() {
        this.p.noStroke()
        this.p.fill(212, 175, 55, 150) // 金色粒子
        this.p.circle(this.pos.x, this.pos.y, 1.5)
      }
    }
  })
}
</script>

<template>
  <div class="min-h-screen flex bg-[#050505] text-[#f0e6d2] overflow-hidden font-sans login-page" data-theme="black-gold">
    <!-- 背景特效层 -->
    <div class="fixed inset-0 z-0 pointer-events-none">
      <!-- THREE.js Canvas - 墨绿+金线地形 -->
      <canvas id="three-canvas" ref="threeCanvasRef" class="absolute inset-0 w-full h-full" />
      <!-- p5.js Canvas - 金色HUD粒子 -->
      <div id="p5-canvas" ref="p5CanvasRef" class="absolute inset-0 w-full h-full opacity-60 pointer-events-none" />
      <!-- 径向渐变遮罩 -->
      <div class="absolute inset-0 bg-radial-gradient" />
    </div>

    <!-- 左侧面板：文字展示区 -->
    <div class="hidden lg:flex lg:w-1/2 relative z-10 flex-col items-center justify-center px-12 py-16">
      <!-- Logo -->
      <div class="absolute top-12 left-12 animate-fade-in-down z-20">
        <svg
          width="800"
          height="320"
          viewBox="0 0 800 320"
          class="h-24 w-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <!-- 金色金属渐变 -->
            <linearGradient
              id="loginGoldGradient"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" style="stop-color:#FDF5D8;stop-opacity:1" />
              <stop offset="30%" style="stop-color:#D4B776;stop-opacity:1" />
              <stop offset="60%" style="stop-color:#F5E6B7;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#9C8449;stop-opacity:1" />
            </linearGradient>

            <!-- 银色/冷色金属渐变 (用于'康'字部分) -->
            <linearGradient
              id="loginSilverGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" style="stop-color:#E8E8E8;stop-opacity:1" />
              <stop offset="50%" style="stop-color:#A0A0A0;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#D0D0D0;stop-opacity:1" />
            </linearGradient>

            <!-- 描边阴影 -->
            <filter
              id="loginShadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="3"
                dy="3"
                stdDeviation="2"
                flood-color="#4a3b18"
                flood-opacity="0.5"
              />
            </filter>
          </defs>

          <!-- 左侧图形：神经网络/大脑 -->
          <g transform="translate(50, 20) scale(0.9)">
            <!-- 连接线 -->
            <g
              stroke="#9C8449"
              stroke-width="4"
              fill="none"
              stroke-linecap="round"
            >
              <path d="M60,150 Q40,100 80,60 T160,30 T240,60" />
              <path d="M60,150 L100,120 L160,130 L200,100" />
              <path d="M80,60 L100,120 L140,80 L160,30" />
              <path d="M160,130 L140,80 L200,100 L240,60" />
              <!-- 大脑外轮廓暗示 -->
              <path
                d="M50,160 C30,120 40,60 100,30 C160,0 260,20 280,80"
                stroke-width="6"
                stroke="#ACA390"
                opacity="0.8"
              />
            </g>

            <!-- 节点 -->
            <g fill="url(#loginGoldGradient)" stroke="#ACA390" stroke-width="2">
              <circle cx="60" cy="150" r="12" />
              <circle cx="100" cy="120" r="10" />
              <circle cx="80" cy="60" r="10" />
              <circle cx="160" cy="30" r="12" />
              <circle cx="140" cy="80" r="8" />
              <circle cx="160" cy="130" r="10" />
              <circle cx="200" cy="100" r="9" />
              <circle cx="240" cy="60" r="11" />
            </g>
          </g>

          <!-- 核心文字部分 -->
          <g transform="translate(200, 70)" filter="url(#loginShadow)">

            <!-- 中文：极 -->
            <text
              x="0"
              y="160"
              font-family="'Microsoft YaHei', 'SimHei', sans-serif"
              font-weight="900"
              font-size="180"
              fill="url(#loginGoldGradient)"
              stroke="#ACA390"
              stroke-width="5"
            >极</text>

            <!-- 中文：康 -->
            <text
              x="180"
              y="160"
              font-family="'Microsoft YaHei', 'SimHei', sans-serif"
              font-weight="900"
              font-size="180"
              fill="url(#loginSilverGradient)"
              stroke="#555"
              stroke-width="5"
            >康</text>

            <!-- 英文：AI (手绘路径以匹配原图的特殊造型) -->
            <g transform="translate(380, 20)">
              <!-- 字母 A -->
              <path
                d="M20,140 L70,10 L120,140 L95,140 L85,110 L55,110 L45,140 Z"
                fill="url(#loginGoldGradient)"
                stroke="#ACA390"
                stroke-width="4"
              />
              <!-- A的一撇/轨道 Swoosh -->
              <path
                d="M0,150 C40,130 60,80 140,50 C100,80 80,110 30,150 Z"
                fill="#EFEFEF"
                stroke="#ACA390"
                stroke-width="2"
              />

              <!-- 字母 I -->
              <rect
                x="150"
                y="10"
                width="35"
                height="130"
                rx="5"
                fill="url(#loginSilverGradient)"
                stroke="#555"
                stroke-width="4"
              />
            </g>
          </g>

          <!-- 底部英文 JIKANG AI TECHNOLOGY -->
          <g transform="translate(250, 290)">
            <text
              font-family="Arial, Helvetica, sans-serif"
              font-weight="bold"
              font-size="36"
              fill="url(#loginGoldGradient)"
              stroke="#4a3b18"
              stroke-width="2"
              letter-spacing="4"
            >
              JIKANG AI TECHNOLOGY
            </text>
          </g>
        </svg>
      </div>

      <!-- 文字标题区域 - 翻页效果 -->
      <div class="relative w-full h-full flex items-center justify-center overflow-visible">
        <div ref="textContainerRef" class="tech-text-container">
          <!-- 中文标题 -->
          <div class="tech-text carousel-text" :class="{ 'page-transition': isTransitioning }" :style="{ fontSize: `${zhFontSize}px` }">
            {{ displayedText }}
          </div>
          <!-- 英文翻译 -->
          <div v-if="displayedEnText" class="tech-subtitle" :class="{ 'page-transition': isTransitioning }">
            <span ref="enTextRef" class="glow-text en-carousel-text" :style="{ fontSize: `${enFontSize}px` }">
              {{ displayedEnText }}
            </span>
          </div>
        </div>
      </div>

      <!-- 底部版权 -->
      <div class="absolute bottom-8 text-xs text-[#888888] tracking-widest uppercase text-center z-20">
        Powered by JiKang AI Technology
      </div>
    </div>

    <!-- 右侧面板：登录表单 -->
    <div class="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
      <!-- 玻璃拟态卡片 -->
      <div class="w-full max-w-md bg-[#121212] backdrop-blur-[30px] backdrop-saturate-[150%] border border-[#1a1a1a] rounded-2xl shadow-[0_25px_50px_rgba(0,0,0,0.8),inset_0_0_1px_rgba(230,213,184,0.3)] p-12 md:p-14 relative overflow-hidden animate-fade-in login-card">
        <!-- 卡片顶部金色装饰线 -->
        <div class="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#e6d5b8] to-transparent opacity-50" />

        <!-- 登录表单内容 -->
        <div class="mb-10 text-left">
          <!-- <h1 class="text-[28px] font-bold mb-2" style="font-family: 'YaHei'; letter-spacing: 2px; background: linear-gradient(to bottom, #f0e6d2, #d4c5a3); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;">极康AI</h1> -->
          <!--          <p class="text-[15px] text-[#e6d5b8] uppercase tracking-[3px] mt-1">我们不生产垃圾数据，只创造极致信用</p> -->
        </div>

        <!-- 身份选择 (已移除) -->
        <!-- <div class="flex justify-center mb-6"> ... </div> -->

        <!-- 登录方式切换 -->
        <div class="flex justify-center mb-8">
          <div class="bg-black/20 p-1 rounded-lg flex items-center">
            <button
              :class="[
                'px-6 py-2 rounded-md text-sm font-medium transition-all duration-300',
                loginType === 'password'
                  ? 'bg-gradient-to-r from-[#e6d5b8] to-[#C5A028] text-[#050505] shadow-lg'
                  : 'text-[#d4c5a3] hover:text-[#f0e6d2]'
              ]"
              @click="loginType = 'password'"
            >
              密码登录
            </button>
            <button
              :class="[
                'px-6 py-2 rounded-md text-sm font-medium transition-all duration-300',
                loginType === 'phone'
                  ? 'bg-gradient-to-r from-[#e6d5b8] to-[#C5A028] text-[#050505] shadow-lg'
                  : 'text-[#d4c5a3] hover:text-[#f0e6d2]'
              ]"
              @click="loginType = 'phone'"
            >
              验证码登录
            </button>
          </div>
        </div>

        <!-- 表单区域 -->
        <div v-if="loginType === 'password'">
          <UForm class="space-y-5" @submit="handlePasswordLogin">
            <!-- 用户名输入框 -->
            <div class="relative">
              <div class="absolute left-0 top-0 bottom-0 flex items-center pl-3 pointer-events-none">
                <svg
                  class="w-5 h-5 text-[#d4c5a3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <input
                v-model="passwordState.username"
                type="text"
                placeholder="用户名 / 邮箱"
                :disabled="loading"
                class="w-full bg-[#1a1a1a] border-0 border-b border-[#1a1a1a] text-[#f0e6d2] placeholder-[#888888] focus:border-b-[#e6d5b8] focus:bg-[rgba(230,213,184,0.1)] focus:outline-none focus:ring-0 focus:shadow-[0_0_10px_rgba(230,213,184,0.2)] transition-all duration-400 pl-10 pr-4 py-3"
              >
            </div>

            <!-- 密码输入框 -->
            <div class="relative">
              <div class="absolute left-0 top-0 bottom-0 flex items-center pl-3 pointer-events-none">
                <svg
                  class="w-5 h-5 text-[#d4c5a3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <button
                type="button"
                class="absolute right-0 top-0 bottom-0 flex items-center pr-3 text-[#888888] hover:text-[#e6d5b8] transition-colors"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <input
                v-model="passwordState.password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="密码"
                :disabled="loading"
                class="w-full bg-[#1a1a1a] border-0 border-b border-[#1a1a1a] text-[#f0e6d2] placeholder-[#888888] focus:border-b-[#e6d5b8] focus:bg-[rgba(230,213,184,0.1)] focus:outline-none focus:ring-0 focus:shadow-[0_0_10px_rgba(230,213,184,0.2)] transition-all duration-400 pl-10 pr-10 py-3"
              >
            </div>

            <div class="flex items-center justify-between text-sm">
              <label class="flex items-center gap-2 cursor-pointer remember-checkbox-label">
                <input
                  v-model="passwordState.remember"
                  type="checkbox"
                  class="remember-checkbox-input"
                >
                <span class="text-[#d4c5a3]">记住我</span>
              </label>
              <UButton
                variant="link"
                size="sm"
                to="/login/forget-password"
                class="text-[#e6d5b8] hover:text-[#FFD700] p-0"
              >
                忘记密码?
              </UButton>
            </div>

            <SlideVerify
              ref="slideVerifyRef"
              :disabled="loading || !passwordState.username || !passwordState.password"
              class="border border-white/10 rounded-xl overflow-hidden"
              @success="onVerifySuccess"
            />

            <UButton
              type="submit"
              block
              size="lg"
              :loading="loading"
              :disabled="!passwordState.username || !passwordState.password || !isVerified"
              class="w-full py-[15px] bg-gradient-to-br from-[#e6d5b8] to-[#C5A028] text-[#050505] text-lg tracking-[5px] rounded-none transition-all duration-300 border-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              登 录
            </UButton>
          </UForm>
        </div>

        <div v-if="loginType === 'phone'">
          <UForm class="space-y-5" @submit="handlePhoneLogin">
            <!-- 手机号输入框 -->
            <div class="relative">
              <div class="absolute left-0 top-0 bottom-0 flex items-center pl-3 pointer-events-none">
                <svg
                  class="w-5 h-5 text-[#d4c5a3]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <input
                v-model="phoneState.phone"
                type="tel"
                placeholder="手机号码"
                :disabled="loading"
                class="w-full bg-[#1a1a1a] border-0 border-b border-[#1a1a1a] text-[#f0e6d2] placeholder-[#888888] focus:border-b-[#e6d5b8] focus:bg-[rgba(230,213,184,0.1)] focus:outline-none focus:ring-0 focus:shadow-[0_0_10px_rgba(230,213,184,0.2)] transition-all duration-400 pl-10 pr-4 py-3"
              >
            </div>

            <div class="flex gap-3">
              <!-- 验证码输入框 -->
              <div class="relative flex-1">
                <div class="absolute left-0 top-0 bottom-0 flex items-center pl-3 pointer-events-none">
                  <svg
                    class="w-5 h-5 text-[#d4c5a3]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <input
                  v-model="phoneState.code"
                  type="text"
                  placeholder="验证码"
                  :disabled="loading"
                  class="w-full bg-[#1a1a1a] border-0 border-b border-[#1a1a1a] text-[#f0e6d2] placeholder-[#888888] focus:border-b-[#e6d5b8] focus:bg-[rgba(230,213,184,0.1)] focus:outline-none focus:ring-0 focus:shadow-[0_0_10px_rgba(230,213,184,0.2)] transition-all duration-400 pl-10 pr-4 py-3"
                >
              </div>
              <UButton
                variant="outline"
                :disabled="loading || sendingCode || codeCountdown > 0 || !phoneState.phone"
                :loading="sendingCode"
                size="lg"
                class="min-w-[120px] bg-transparent border border-[#e6d5b8] text-[#e6d5b8] hover:bg-[#e6d5b8] hover:text-[#050505] rounded-none text-[11px] transition-all duration-300"
                @click="handleSendCode"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}s` : '获取验证码' }}
              </UButton>
            </div>

            <SlideVerify
              ref="slideVerifyPhoneRef"
              :disabled="loading || !phoneState.phone"
              class="border border-white/10 rounded-xl overflow-hidden"
              @success="onVerifyPhoneSuccess"
            />

            <UButton
              type="submit"
              block
              size="lg"
              :loading="loading"
              :disabled="!phoneState.phone || !phoneState.code || !isPhoneVerified"
              class="w-full py-[15px] bg-gradient-to-br from-[#e6d5b8] to-[#C5A028] text-[#050505] text-lg tracking-[5px] rounded-none transition-all duration-300 border-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              登 录
            </UButton>
          </UForm>
        </div>

        <!-- 注册链接 -->
        <div class="mt-6 text-center text-xs text-[#d4c5a3]">
          还没有账号?
          <UButton
            variant="link"
            to="/login/register"
            class="text-[#e6d5b8] hover:text-[#FFD700] font-medium px-1"
          >
            立即注册
          </UButton>
        </div>
      </div>

      <!-- 底部工具栏 -->
      <div class="absolute top-8 right-8 flex gap-4">
        <UButton
          variant="ghost"
          color="gray"
          icon="i-lucide-globe"
          class="text-[#888888] hover:text-[#f0e6d2] hover:bg-[#1a1a1a] rounded-full"
        />
        <UButton
          variant="ghost"
          color="gray"
          icon="i-lucide-help-circle"
          class="text-[#888888] hover:text-[#f0e6d2] hover:bg-[#1a1a1a] rounded-full"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 径向渐变遮罩 */
.bg-radial-gradient {
  background: radial-gradient(circle at center, transparent, rgba(0,0,0,0.6));
}

/* 复选框样式 - 使用原生checkbox，只显示边框和对号 */
.remember-checkbox-label {
  user-select: none;
}

.remember-checkbox-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  border: 2px solid #888888;
  border-radius: 4px;
  background-color: transparent;
  background: transparent;
  position: relative;
  margin: 0;
  flex-shrink: 0;
  transition: border-color 0.2s ease;
}

.remember-checkbox-input:hover {
  border-color: #e6d5b8;
}

.remember-checkbox-input:checked {
  border-color: #e6d5b8;
  background-color: transparent;
  background: transparent;
}

.remember-checkbox-input:checked::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 5px;
  height: 10px;
  border: solid #e6d5b8;
  border-width: 0 2px 2px 0;
  border-radius: 0;
}

.remember-checkbox-input:focus {
  outline: none;
  border-color: #e6d5b8;
  box-shadow: 0 0 0 2px rgba(230, 213, 184, 0.2);
}

@keyframes aurora-move {
  0% { transform: translate(0, 0) rotate(0deg); }
  100% { transform: translate(-5%, -5%) rotate(5deg); }
}

/* 动画工具类 */
.animate-fade-in {
  animation: fadeIn 0.8s ease-out;
}

.animate-fade-in-down {
  animation: fadeInDown 0.8s ease-out;
}

.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* SVG 动画 */
.cursor-blink {
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.arm-left {
  animation: typeLeft 0.5s ease-in-out infinite alternate;
}

.arm-right {
  animation: typeRight 0.5s ease-in-out infinite alternate;
  animation-delay: 0.25s;
}

@keyframes typeLeft {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(5deg) translateY(-2px); }
}

@keyframes typeRight {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(-5deg) translateY(-2px); }
}

.code-lines rect {
  animation: codeScan 2s linear infinite;
}

@keyframes codeScan {
  0% { opacity: 0.4; }
  50% { opacity: 0.8; }
  100% { opacity: 0.4; }
}

.particle {
  animation: float 4s ease-in-out infinite;
}

.p1 { animation-delay: 0s; }
.p2 { animation-delay: 1s; }
.p3 { animation-delay: 2s; }
.p4 { animation-delay: 3s; }

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

/* 科技感文字效果 */
.tech-text-container {
  display: flex;
  flex-direction: column;
  align-items: center; /* 改为居中对齐 */
  justify-content: center;
  position: relative;
  z-index: 10;
  pointer-events: none;
  width: auto; /* 改为auto，根据内容自适应 */
  max-width: none; /* 移除最大宽度限制，允许文字完整显示 */
  overflow: visible; /* 改为visible，确保文字不被遮挡 */
  padding: 0 40px; /* 增加左右padding，为文字预留足够空间 */
  box-sizing: border-box;
  margin-left: 70px; /* 向右移动70px */
}

.tech-text {
  font-size: 140px;
  font-weight: 700;
  letter-spacing: 8px;
  text-align: left; /* 改为左对齐 */
  position: relative;
  margin-bottom: 40px;
  font-family: 'YaHei', 'Microsoft YaHei', '微软雅黑', sans-serif;
  line-height: 1.3;
  background: linear-gradient(to bottom, #f0e6d2, #d4c5a3);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  width: auto; /* 改为auto，根据内容自适应 */
  min-width: 0; /* 允许收缩 */
  white-space: nowrap;
  overflow: visible;
  padding: 0;
  box-sizing: border-box;
  display: inline-block; /* 改为inline-block，让宽度自适应内容 */
  backface-visibility: hidden;
  -webkit-font-smoothing: antialiased;
}

.tech-text .char {
  display: inline-block;
  position: relative;
  background: linear-gradient(to bottom, #f0e6d2, #d4c5a3);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: charFadeIn 0.2s ease-out forwards;
  opacity: 0;
  will-change: opacity, transform;
  backface-visibility: hidden;
}

@keyframes charFadeIn {
  from {
    opacity: 0;
    transform: translate3d(0, 10px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

.carousel-text {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  text-align: center;
  width: 100%;
  transition: opacity 0.6s ease-in-out, transform 0.6s ease-in-out;
}

/* 翻页过渡动画 */
.page-transition {
  opacity: 0;
  transform: translateY(20px); /* 移除translateX，因为容器已经有margin-left */
}

.tech-text:not(.page-transition),
.tech-subtitle:not(.page-transition) {
  opacity: 1;
  transform: translateY(0); /* 移除translateX，因为容器已经有margin-left */
}

.carousel-text .cursor-blink {
  display: inline-block;
  color: #e6d5b8;
  margin-left: 4px;
  animation: blink 1s step-end infinite;
}

.tech-subtitle {
  margin-top: 30px;
  text-align: center; /* 居中对齐 */
  font-size: 24px; /* 基础大小，会被JS动态调整 */
  letter-spacing: 4px;
  text-transform: none;
  width: auto; /* 改为auto，根据内容自适应 */
  min-width: 0; /* 允许收缩 */
  white-space: nowrap;
  overflow: visible;
  padding: 0;
  box-sizing: border-box;
  display: inline-block; /* 改为inline-block，让宽度自适应内容 */
  color: #e6d5b8;
  font-weight: 400;
  opacity: 0.85;
  font-family: 'Arial', 'Helvetica', sans-serif;
  transition: opacity 0.6s ease-in-out, transform 0.6s ease-in-out;
}

.tech-subtitle .glow-text {
  display: inline-block;
  transform-origin: center;
  backface-visibility: hidden;
}

.en-carousel-text {
  display: inline-block;
}

.glow-text {
  color: rgba(212, 175, 55, 0.95);
  font-weight: 300;
}

.tech-slogan {
  margin-top: 40px;
  text-align: center;
}

.slogan-text {
  color: rgba(212, 175, 55, 0.9);
  font-size: 18px;
  font-weight: 400;
  letter-spacing: 2px;
  font-family: 'Microsoft YaHei', '微软雅黑', sans-serif;
}

/* 案例展示卡片 */
.case-card {
  background: #121212;
  backdrop-filter: blur(10px);
  border: 1px solid #1a1a1a;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.case-card:hover {
  border-color: rgba(212, 175, 55, 0.4);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(212, 175, 55, 0.2);
}

.case-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.case-icon svg {
  width: 24px;
  height: 24px;
}

.case-icon-green {
  background: rgba(212, 175, 55, 0.2);
  color: #e6d5b8;
}

.case-icon-blue {
  background: rgba(212, 175, 55, 0.2);
  color: #FFD700;
}

.case-icon-gold {
  background: rgba(212, 175, 55, 0.25);
  color: #e6d5b8;
}

.case-title {
  font-size: 16px;
  font-weight: 700;
  color: #f0e6d2;
  margin-bottom: 8px;
  line-height: 1.4;
}

.case-description {
  font-size: 12px;
  color: #d4c5a3;
  line-height: 1.6;
  margin-bottom: 12px;
}

.case-progress {
  width: 100%;
  height: 4px;
  background: #1a1a1a;
  border-radius: 2px;
  overflow: hidden;
}

.case-progress-bar {
  height: 100%;
  width: 65%;
  background: linear-gradient(90deg, #e6d5b8 0%, #FFD700 100%);
  border-radius: 2px;
  animation: progressShimmer 2s ease-in-out infinite;
}

@keyframes progressShimmer {
  0%, 100% { opacity: 0.8; }
  50% { opacity: 1; }
}

.case-graph {
  position: relative;
  height: 60px;
  width: 100%;
  margin-top: 8px;
}

.case-graph-line {
  position: absolute;
  bottom: 20px;
  left: 10px;
  width: calc(100% - 40px);
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #e6d5b8 50%, transparent 100%);
  border-top: 2px dashed #e6d5b8;
  transform: rotate(-5deg);
}

.case-graph-line::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: -4px;
  width: 8px;
  height: 8px;
  background: #f0e6d2;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
}

.case-graph-line::after {
  content: '';
  position: absolute;
  right: 0;
  top: -4px;
  width: 12px;
  height: 12px;
  background: #f0e6d2;
  border-radius: 50%;
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.8);
}

.case-graph-label {
  position: absolute;
  font-size: 10px;
  color: #d4c5a3;
  top: 0;
}

.case-graph-label-left {
  left: 0;
}

.case-graph-label-right {
  right: 0;
}

.case-button {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, #e6d5b8 0%, #C5A028 100%);
  color: #050505;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 8px;
}

.case-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(212, 175, 55, 0.5);
  background: linear-gradient(135deg, #FFD700 0%, #e6d5b8 100%);
}
</style>

<style>
/* 全局样式 - 强制复选框透明背景（针对记住我复选框） */
.login-page .remember-checkbox button[role="checkbox"],
.login-page .remember-checkbox button[type="button"][role="checkbox"],
.login-page .remember-checkbox [role="checkbox"] {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

.login-page .remember-checkbox button[role="checkbox"][aria-checked="true"],
.login-page .remember-checkbox button[aria-checked="true"] {
  background-color: transparent !important;
  background: transparent !important;
  background-image: none !important;
}

.login-page .remember-checkbox button[role="checkbox"]:hover,
.login-page .remember-checkbox button[role="checkbox"]:focus,
.login-page .remember-checkbox button[role="checkbox"]:active {
  background-color: transparent !important;
  background: transparent !important;
}
</style>
