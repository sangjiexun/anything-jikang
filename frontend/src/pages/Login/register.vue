<script lang="ts" setup>
import { onMounted, onBeforeUnmount } from 'vue'

definePageMeta({
  layout: false
})

const { register } = useAuth()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const state = reactive({
  username: '',
  email: '',
  phone: '',
  phoneCode: '',
  password: '',
  confirmPassword: '',
  agreeTerms: false,
  inviterCode: ''
})

const loading = ref(false)
const sendingCode = ref(false)
const codeCountdown = ref(0)
const isSendingCode = ref(false) // 防止重复发送
let countdownTimer: NodeJS.Timeout | null = null // 倒计时定时器
const { get, post } = useApi()

// 从URL参数获取邀请人ID
onMounted(() => {
  const inviter = route.query.inviter as string
  if (inviter) {
    state.inviterCode = inviter
  }
})

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
})

const passwordMatch = computed(() => {
  if (!state.confirmPassword) return true
  return state.password === state.confirmPassword
})

// 发送注册验证码
async function handleSendRegisterCode() {
  // 如果正在倒计时，不允许发送
  if (codeCountdown.value > 0) {
    toast.add({
      title: '提示',
      description: `请等待 ${codeCountdown.value} 秒后再试`,
      color: 'warning',
      timeout: 2000
    })
    return
  }

  // 如果正在发送，不允许重复点击
  if (isSendingCode.value || sendingCode.value) {
    return
  }

  if (!state.phone) {
    toast.add({
      title: '提示',
      description: '请输入手机号',
      color: 'warning'
    })
    return
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(state.phone)) {
    toast.add({
      title: '提示',
      description: '手机号格式不正确',
      color: 'warning'
    })
    return
  }

  // 立即设置发送标志
  isSendingCode.value = true
  sendingCode.value = true

  try {
    console.log('发送注册验证码请求', { phone: state.phone })
    const response = await post('/auth/register/send-code', {
      phone: state.phone
    })
    console.log('注册验证码发送响应', response)

    if (response.success) {
      toast.add({
        title: '成功',
        description: response.data?.message || '验证码已发送',
        color: 'success'
      })

      // 开发环境显示验证码
      if (response.data?.code) {
        console.log(`[开发环境] 验证码: ${response.data.code}`)
        toast.add({
          title: '开发环境提示',
          description: `验证码: ${response.data.code}`,
          color: 'info',
          timeout: 10000
        })
      }

      // 开始倒计时（60秒）
      codeCountdown.value = 60
      // 清除之前的定时器（如果有）
      if (countdownTimer) {
        clearInterval(countdownTimer)
      }
      countdownTimer = setInterval(() => {
        codeCountdown.value--
        if (codeCountdown.value <= 0) {
          clearInterval(countdownTimer!)
          countdownTimer = null
        }
      }, 1000)
    } else {
      toast.add({
        title: '错误',
        description: response.message || '发送失败',
        color: 'error'
      })
    }
  } catch (error: any) {
    console.error('发送注册验证码失败:', error)
    let errorMessage = '发送验证码失败'

    // 尝试从不同位置获取错误消息
    if (error.data?.message) {
      errorMessage = error.data.message
    } else if (error.data?.error) {
      errorMessage = error.data.error
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message
    }

    toast.add({
      title: '错误',
      description: errorMessage,
      color: 'error'
    })
  } finally {
    // 确保释放发送标志
    isSendingCode.value = false
    sendingCode.value = false
  }
}

async function handleRegister() {
  if (!state.username || !state.password) {
    toast.add({
      title: '错误',
      description: '用户名和密码不能为空',
      color: 'error'
    })
    return
  }

  if (!state.email && !state.phone) {
    toast.add({
      title: '错误',
      description: '邮箱或手机号至少填写一个',
      color: 'error'
    })
    return
  }

  // 如果提供了手机号，必须验证验证码
  if (state.phone) {
    if (!state.phoneCode) {
      toast.add({
        title: '错误',
        description: '请输入手机验证码',
        color: 'error'
      })
      return
    }

    // 验证验证码格式
    if (!/^\d{6}$/.test(state.phoneCode)) {
      toast.add({
        title: '错误',
        description: '验证码格式不正确（6位数字）',
        color: 'error'
      })
      return
    }
  }

  if (!passwordMatch.value) {
    toast.add({
      title: '错误',
      description: '两次输入的密码不一致',
      color: 'error'
    })
    return
  }

  if (!state.agreeTerms) {
    toast.add({
      title: '错误',
      description: '请同意服务条款和隐私政策',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    await register({
      username: state.username,
      email: state.email || undefined,
      phone: state.phone || undefined,
      phoneCode: state.phone ? state.phoneCode : undefined,
      password: state.password,
      inviterCode: state.inviterCode || undefined
    })
    toast.add({
      title: '成功',
      description: '注册成功',
      color: 'success'
    })
    router.push('/')
  } catch (error: any) {
    toast.add({
      title: '错误',
      description: error.data?.message || '注册失败，请重试',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-900">
    <div class="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800 max-h-[90vh] overflow-y-auto">
      <!-- 标题 -->
      <div class="px-6 py-5 border-b border-gray-800">
        <h2 class="text-xl font-semibold text-white">
          创建账户
        </h2>
        <p class="text-sm text-gray-400 mt-1">
          注册新账户以开始使用
        </p>
      </div>

      <div class="p-6 space-y-6">
        <form class="space-y-6" @submit.prevent="handleRegister">
          <!-- 用户名 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">用户名 <span class="text-red-400">*</span></label>
            <input
              v-model="state.username"
              type="text"
              placeholder="请输入用户名"
              :disabled="loading"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
          </div>

          <!-- 邮箱 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">邮箱（用于找回密码）</label>
            <input
              v-model="state.email"
              type="email"
              placeholder="请输入邮箱地址"
              :disabled="loading"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
          </div>

          <!-- 手机号 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">手机号（用于找回密码）</label>
            <div class="flex gap-3">
              <input
                v-model="state.phone"
                type="tel"
                placeholder="请输入手机号"
                :disabled="loading"
                class="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
              <button
                type="button"
                :disabled="loading || sendingCode || isSendingCode || codeCountdown > 0 || !state.phone"
                class="min-w-[120px] px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                @click="handleSendRegisterCode"
              >
                {{ codeCountdown > 0 ? `${codeCountdown}秒` : sendingCode ? '发送中...' : '获取验证码' }}
              </button>
            </div>
          </div>

          <!-- 手机验证码 -->
          <div v-if="state.phone">
            <label class="block text-sm font-medium text-gray-300 mb-3">手机验证码 <span class="text-red-400">*</span></label>
            <input
              v-model="state.phoneCode"
              type="text"
              placeholder="请输入6位验证码"
              maxlength="6"
              :disabled="loading"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
          </div>

          <!-- 密码 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">密码 <span class="text-red-400">*</span></label>
            <input
              v-model="state.password"
              type="password"
              placeholder="请输入密码"
              :disabled="loading"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
          </div>

          <!-- 确认密码 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">确认密码 <span class="text-red-400">*</span></label>
            <input
              v-model="state.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              :disabled="loading"
              :class="[
                'w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all',
                !passwordMatch && state.confirmPassword ? 'border-red-500' : 'border-gray-700'
              ]"
            >
            <p v-if="!passwordMatch && state.confirmPassword" class="text-xs text-red-400 mt-1">
              两次输入的密码不一致
            </p>
          </div>

          <!-- 同意条款 -->
          <div class="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <input
              v-model="state.agreeTerms"
              type="checkbox"
              :disabled="loading"
              class="mt-0.5 w-4 h-4 rounded bg-gray-800 border-gray-700 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
            >
            <label class="flex-1 text-sm text-gray-300 cursor-pointer">
              我已阅读并同意
              <a href="#" class="text-blue-400 hover:text-blue-300 transition-colors">服务条款</a>
              和
              <a href="#" class="text-blue-400 hover:text-blue-300 transition-colors">隐私政策</a>
            </label>
          </div>

          <!-- 注册按钮 -->
          <button
            type="submit"
            :disabled="loading || !state.username || !state.password || !state.agreeTerms || (!state.email && !state.phone)"
            class="w-full px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span v-if="loading" class="animate-spin">⏳</span>
            <span v-else>注册</span>
          </button>
        </form>

        <!-- 底部链接 -->
        <div class="pt-4 border-t border-gray-800 space-y-3">
          <div class="text-center text-sm text-gray-400">
            已有账户？
            <NuxtLink to="/login" class="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              立即登录
            </NuxtLink>
          </div>
          <div v-if="state.inviterCode" class="text-center text-xs text-green-400">
            🎁 通过邀请注册，注册成功即可获得8000积分奖励
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
