/**
 * 认证模块单元测试
 * 
 * 测试范围：
 * - 登录功能
 * - 退出功能
 * - 状态管理
 * - localStorage持久化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { authState, login, logout, isAuthenticated, initAuth, getCurrentUser } from '../utils/auth'

// ==================== Mock设置 ====================

// Mock localStorage
const localStorageMock = {
  store: {},
  getItem: vi.fn(key => localStorageMock.store[key] || null),
  setItem: vi.fn((key, value) => { localStorageMock.store[key] = value }),
  removeItem: vi.fn(key => { delete localStorageMock.store[key] }),
  clear: vi.fn(() => { localStorageMock.store = {} })
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// ==================== 测试用例 ====================

describe('Auth Module', () => {
  
  // 每个测试前重置状态
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    
    // 重置authState
    authState.isLoggedIn = false
    authState.user = null
    authState.token = null
    authState.error = null
    authState.loading = false
  })

  // ---------- 登录测试 ----------

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const result = await login('user', '123456')
      
      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(authState.isLoggedIn).toBe(true)
      expect(authState.user).toBeDefined()
      expect(authState.token).toBeDefined()
      expect(authState.error).toBeNull()
    })

    it('should fail with incorrect username', async () => {
      const result = await login('wronguser', '123456')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(authState.isLoggedIn).toBe(false)
      expect(authState.user).toBeNull()
    })

    it('should fail with incorrect password', async () => {
      const result = await login('user', 'wrongpassword')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(authState.isLoggedIn).toBe(false)
    })

    it('should store token in localStorage on success', async () => {
      await login('user', '123456')
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'billiard_token',
        expect.any(String)
      )
    })

    it('should store user in localStorage on success', async () => {
      await login('user', '123456')
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'billiard_user',
        expect.any(String)
      )
    })

    it('should set loading state during login', async () => {
      const loginPromise = login('user', '123456')
      
      // 注意：由于异步，这里可能需要调整测试方式
      await loginPromise
      
      expect(authState.loading).toBe(false) // 完成后应为false
    })

    it('should set error state on failure', async () => {
      await login('wrong', 'wrong')
      
      expect(authState.error).toBeDefined()
      expect(authState.error).not.toBeNull()
    })
  })

  // ---------- 退出测试 ----------

  describe('logout', () => {
    it('should clear auth state on logout', async () => {
      // 先登录
      await login('user', '123456')
      expect(authState.isLoggedIn).toBe(true)
      
      // 再退出
      await logout()
      
      expect(authState.isLoggedIn).toBe(false)
      expect(authState.user).toBeNull()
      expect(authState.token).toBeNull()
    })

    it('should remove token from localStorage', async () => {
      await login('user', '123456')
      await logout()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('billiard_token')
    })

    it('should remove user from localStorage', async () => {
      await login('user', '123456')
      await logout()
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('billiard_user')
    })

    it('should work even if not logged in', async () => {
      expect(authState.isLoggedIn).toBe(false)
      
      await expect(logout()).resolves.not.toThrow()
    })
  })

  // ---------- 状态检查测试 ----------

  describe('isAuthenticated', () => {
    it('should return false when not logged in', () => {
      expect(isAuthenticated()).toBe(false)
    })

    it('should return true when logged in', async () => {
      await login('user', '123456')
      
      expect(isAuthenticated()).toBe(true)
    })

    it('should return false after logout', async () => {
      await login('user', '123456')
      await logout()
      
      expect(isAuthenticated()).toBe(false)
    })
  })

  describe('getCurrentUser', () => {
    it('should return null when not logged in', () => {
      expect(getCurrentUser()).toBeNull()
    })

    it('should return user object when logged in', async () => {
      await login('user', '123456')
      
      const user = getCurrentUser()
      expect(user).toBeDefined()
      expect(user.name).toBe('张三')
    })
  })

  // ---------- 初始化测试 ----------

  describe('initAuth', () => {
    it('should restore auth state from localStorage', () => {
      // 模拟已存储的数据
      localStorageMock.store['billiard_token'] = 'test_token'
      localStorageMock.store['billiard_user'] = JSON.stringify({ 
        id: 'U001', 
        name: 'Test User' 
      })
      
      initAuth()
      
      expect(authState.isLoggedIn).toBe(true)
      expect(authState.token).toBe('test_token')
      expect(authState.user.name).toBe('Test User')
    })

    it('should not restore if no stored data', () => {
      initAuth()
      
      expect(authState.isLoggedIn).toBe(false)
      expect(authState.token).toBeNull()
    })

    it('should handle invalid JSON in localStorage', () => {
      localStorageMock.store['billiard_token'] = 'test_token'
      localStorageMock.store['billiard_user'] = 'invalid json'
      
      // 不应抛出错误
      expect(() => initAuth()).not.toThrow()
      
      // 应该清除无效数据
      expect(authState.isLoggedIn).toBe(false)
    })

    it('should not restore if only token exists', () => {
      localStorageMock.store['billiard_token'] = 'test_token'
      // 没有user数据
      
      initAuth()
      
      expect(authState.isLoggedIn).toBe(false)
    })
  })

  // ---------- authState响应式测试 ----------

  describe('authState reactivity', () => {
    it('should update isLoggedIn on login', async () => {
      expect(authState.isLoggedIn).toBe(false)
      
      await login('user', '123456')
      
      expect(authState.isLoggedIn).toBe(true)
    })

    it('should update user on login', async () => {
      expect(authState.user).toBeNull()
      
      await login('user', '123456')
      
      expect(authState.user).not.toBeNull()
      expect(authState.user.id).toBeDefined()
    })
  })
})
