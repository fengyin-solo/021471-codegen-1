/**
 * 认证状态管理模块
 * 
 * 功能说明：
 * - 管理用户登录状态
 * - 处理登录/退出逻辑
 * - 持久化存储认证信息
 * 
 * 使用方式：
 * import { authState, login, logout, isAuthenticated } from '@/utils/auth'
 * 
 * // 检查登录状态
 * if (authState.isLoggedIn) { ... }
 * 
 * // 执行登录
 * const result = await login('user', '123456')
 * 
 * // 执行退出
 * await logout()
 */

import { reactive } from 'vue'
import { api, logger } from './api'

// ==================== 常量定义 ====================

/** localStorage中存储token的键名 */
const AUTH_TOKEN_KEY = 'billiard_token'

/** localStorage中存储用户信息的键名 */
const AUTH_USER_KEY = 'billiard_user'

const unauthorizedListeners = new Set()

/**
 * 登录失效时通知页面中断当前操作。
 */
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

export function notifyUnauthorized(message = '登录已失效，请重新登录') {
  clearAuth()
  unauthorizedListeners.forEach(listener => {
    try {
      listener(message)
    } catch (error) {
      logger.error('Unauthorized listener error', error)
    }
  })
}

/**
 * 将钱包资产同步到用户信息，保证页面各卡片读取同一份数值。
 */
export function syncUserAssets(assets = {}) {
  if (!authState.user) return

  const balance = Number(assets.balance)
  const points = Number(assets.points)
  if (Number.isFinite(balance)) authState.user.balance = Math.max(0, Math.round(balance * 100) / 100)
  if (Number.isSafeInteger(points)) authState.user.points = Math.max(0, points)
  if (Number.isSafeInteger(assets.couponCount)) authState.user.couponCount = Math.max(0, assets.couponCount)
  if (Number.isFinite(assets.couponValue)) authState.user.couponValue = Math.max(0, assets.couponValue)

  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(authState.user))
  } catch (error) {
    logger.error('Failed to sync user assets', error)
  }
}

// ==================== 响应式状态 ====================

/**
 * 认证状态对象（响应式）
 * 
 * @property {boolean} isLoggedIn - 是否已登录
 * @property {Object|null} user - 当前用户信息
 * @property {string|null} token - 认证令牌
 * @property {boolean} loading - 是否正在进行认证操作
 * @property {string|null} error - 最近一次错误信息
 * 
 * 使用示例：
 * import { authState } from '@/utils/auth'
 * 
 * // 在模板中使用
 * <div v-if="authState.isLoggedIn">欢迎, {{ authState.user.name }}</div>
 * 
 * // 在计算属性中使用
 * computed: {
 *   isLoggedIn() { return authState.isLoggedIn }
 * }
 */
export const authState = reactive({
  isLoggedIn: false,
  user: null,
  token: null,
  loading: false,
  error: null
})

// ==================== 公共方法 ====================

/**
 * 初始化认证状态
 * 从localStorage恢复登录状态
 * 
 * 应在应用启动时调用（main.js）
 * 
 * 使用示例：
 * import { initAuth } from '@/utils/auth'
 * initAuth()
 */
export function initAuth() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userStr = localStorage.getItem(AUTH_USER_KEY)
  
  if (token && userStr) {
    try {
      authState.token = token
      authState.user = JSON.parse(userStr)
      authState.isLoggedIn = true
      logger.info('Auth initialized from storage', { userId: authState.user?.id })
    } catch (e) {
      // JSON解析失败，清除无效数据
      logger.error('Failed to parse stored user data', e)
      clearAuth()
    }
  }
}

/**
 * 用户登录
 * 
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 * 
 * 使用示例：
 * const result = await login('user', '123456')
 * if (result.success) {
 *   console.log('登录成功', result.user)
 * } else {
 *   console.log('登录失败', result.error)
 * }
 */
export async function login(username, password) {
  // 设置加载状态
  authState.loading = true
  authState.error = null
  
  try {
    logger.info('Login attempt', { username })
    
    // 调用登录API
    const result = await api.login(username, password)
    
    if (result.success) {
      const { token, user } = result.data
      
      // 更新状态
      authState.token = token
      authState.user = user
      authState.isLoggedIn = true
      
      // 持久化存储
      localStorage.setItem(AUTH_TOKEN_KEY, token)
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
      
      logger.info('Login successful', { userId: user.id })
      return { success: true, user }
    } else {
      throw new Error(result.error || '登录失败')
    }
  } catch (error) {
    // 记录错误
    authState.error = error.message
    logger.error('Login failed', error)
    return { success: false, error: error.message }
  } finally {
    // 重置加载状态
    authState.loading = false
  }
}

/**
 * 用户退出登录
 * 清除本地状态和存储
 * 
 * 使用示例：
 * await logout()
 * router.push('/login')
 */
export async function logout() {
  try {
    logger.info('Logout', { userId: authState.user?.id })
    
    // 调用退出API（可选，主要用于服务端清理）
    await api.logout()
  } catch (e) {
    // 即使API调用失败，也要清除本地状态
    logger.warn('Logout API failed', e)
  } finally {
    clearAuth()
  }
}

/**
 * 检查是否已登录
 * 
 * @returns {boolean} 是否已登录
 * 
 * 使用示例：
 * if (isAuthenticated()) {
 *   // 执行需要登录的操作
 * }
 */
export function isAuthenticated() {
  return authState.isLoggedIn && !!authState.token
}

/**
 * 获取当前登录用户
 * 
 * @returns {Object|null} 用户信息，未登录返回null
 * 
 * 使用示例：
 * const user = getCurrentUser()
 * if (user) {
 *   console.log('当前用户:', user.name)
 * }
 */
export function getCurrentUser() {
  return authState.user
}

// ==================== 私有方法 ====================

/**
 * 清除认证状态
 * 重置所有状态并清除localStorage
 * 
 * @private
 */
function clearAuth() {
  // 重置状态
  authState.isLoggedIn = false
  authState.user = null
  authState.token = null
  authState.error = null
  
  // 清除存储
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
  
  logger.info('Auth state cleared')
}

// ==================== 默认导出 ====================

export default {
  authState,
  initAuth,
  login,
  logout,
  isAuthenticated,
  getCurrentUser
}
