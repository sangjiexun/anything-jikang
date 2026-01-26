<script lang="ts" setup>
definePageMeta({
  layout: false
})

// 重定向到新的登录页面（扫码登录标签）
onMounted(() => {
  navigateTo('/login?type=qrcode')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <p class="text-gray-400">
        正在跳转到登录页面...
      </p>
    </div>
  </div>
</template>
