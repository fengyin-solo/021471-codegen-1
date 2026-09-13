import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initAuth } from './utils/auth'
import { logger } from './utils/api'

// 初始化认证状态
initAuth()

// 全局错误处理
window.addEventListener('error', (event) => {
  logger.error('Global error', { message: event.message, filename: event.filename, lineno: event.lineno })
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', { reason: event.reason })
})

logger.info('Application starting')

const app = createApp(App)
app.use(router)
app.mount('#app')

logger.info('Application mounted')
