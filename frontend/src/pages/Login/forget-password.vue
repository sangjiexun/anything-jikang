<script lang="ts" setup>
definePageMeta({
  layout: false
})

const router = useRouter()
const toast = useToast()

const state = reactive({
  email: ''
})

const loading = ref(false)

async function handleSubmit() {
  if (!state.email) {
    toast.add({
      title: '错误',
      description: '请输入您的邮箱地址',
      color: 'red'
    })
    return
  }

  loading.value = true
  try {
    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1500))
    toast.add({
      title: '成功',
      description: '密码重置链接已发送到您的邮箱',
      color: 'green'
    })
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  } catch (error) {
    toast.add({
      title: '错误',
      description: '发送重置链接失败，请重试',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-gray-900">
    <div class="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
      <!-- 标题 -->
      <div class="px-6 py-5 border-b border-gray-800">
        <h2 class="text-xl font-semibold text-white">
          忘记密码
        </h2>
        <p class="text-sm text-gray-400 mt-1">
          请输入您的邮箱地址，我们将发送密码重置链接
        </p>
      </div>

      <div class="p-6 space-y-6">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- 邮箱 -->
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-3">邮箱</label>
            <input
              v-model="state.email"
              type="email"
              placeholder="请输入邮箱地址"
              :disabled="loading"
              class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
          </div>

          <!-- 发送按钮 -->
          <button
            type="submit"
            :disabled="loading || !state.email"
            class="w-full px-5 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <span v-if="loading" class="animate-spin">⏳</span>
            <span v-else>发送重置链接</span>
          </button>
        </form>

        <!-- 底部链接 -->
        <div class="pt-4 border-t border-gray-800">
          <div class="text-center text-sm text-gray-400">
            记起密码了？
            <NuxtLink to="/login" class="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              返回登录
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
