/**
 * API模块单元测试
 * 
 * 测试范围：
 * - 登录/退出接口
 * - 数据获取接口
 * - 日志记录器
 * - 错误处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { api, logger } from '../utils/api'

// ==================== API接口测试 ====================

describe('API Module', () => {
  
  // ---------- 认证接口测试 ----------
  
  describe('api.login', () => {
    it('should return success with valid credentials', async () => {
      const result = await api.login('user', '123456')
      
      expect(result.success).toBe(true)
      expect(result.data.token).toBeDefined()
      expect(result.data.user).toBeDefined()
      expect(result.data.user.name).toBe('张三')
    })

    it('should return error with invalid username', async () => {
      const result = await api.login('invalid', '123456')
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should return error with invalid password', async () => {
      const result = await api.login('user', 'wrongpassword')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('密码')
    })

    it('should return error with empty credentials', async () => {
      const result = await api.login('', '')
      
      expect(result.success).toBe(false)
    })
  })

  describe('api.logout', () => {
    it('should return success on logout', async () => {
      const result = await api.logout()
      
      expect(result.success).toBe(true)
    })
  })

  // ---------- 球桌接口测试 ----------

  describe('api.getTables', () => {
    it('should return tables list', async () => {
      const result = await api.getTables()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('should return tables with required fields', async () => {
      const result = await api.getTables()
      const table = result.data[0]
      
      expect(table).toHaveProperty('id')
      expect(table).toHaveProperty('name')
      expect(table).toHaveProperty('type')
      expect(table).toHaveProperty('typeId')
      expect(table).toHaveProperty('price')
      expect(table).toHaveProperty('available')
      expect(table).toHaveProperty('size')
      expect(table).toHaveProperty('brand')
    })

    it('should have valid table types', async () => {
      const result = await api.getTables()
      const validTypes = ['snooker', 'pool', 'chinese']
      
      result.data.forEach(table => {
        expect(validTypes).toContain(table.typeId)
      })
    })
  })

  describe('api.bookTable', () => {
    it('should create booking successfully', async () => {
      const bookingData = {
        tableId: 1,
        date: '2026-03-01',
        timeSlot: '14:00-16:00',
        duration: 2
      }
      
      const result = await api.bookTable(bookingData)
      
      expect(result.success).toBe(true)
      expect(result.data.orderNo).toBeDefined()
      expect(result.data.orderNo).toMatch(/^BK\d+$/)
      expect(result.data.status).toBe('upcoming')
    })
  })

  // ---------- 课程接口测试 ----------

  describe('api.getCourses', () => {
    it('should return courses list', async () => {
      const result = await api.getCourses()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should return courses with required fields', async () => {
      const result = await api.getCourses()
      
      if (result.data.length > 0) {
        const course = result.data[0]
        expect(course).toHaveProperty('id')
        expect(course).toHaveProperty('name')
        expect(course).toHaveProperty('price')
        expect(course).toHaveProperty('coach')
      }
    })
  })

  // ---------- 赛事接口测试 ----------

  describe('api.getCompetitions', () => {
    it('should return competitions list', async () => {
      const result = await api.getCompetitions()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should return competitions with valid status', async () => {
      const result = await api.getCompetitions()
      const validStatuses = ['upcoming', 'ongoing', 'finished']
      
      result.data.forEach(comp => {
        expect(validStatuses).toContain(comp.status)
      })
    })
  })

  // ---------- 商品接口测试 ----------

  describe('api.getProducts', () => {
    it('should return products list', async () => {
      const result = await api.getProducts()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('should return products with price info', async () => {
      const result = await api.getProducts()
      
      result.data.forEach(product => {
        expect(product.price).toBeGreaterThan(0)
        expect(typeof product.price).toBe('number')
      })
    })
  })

  describe('api.createOrder', () => {
    it('should create order successfully', async () => {
      const orderData = {
        items: [{ productId: 1, quantity: 1 }]
      }
      
      const result = await api.createOrder(orderData)
      
      expect(result.success).toBe(true)
      expect(result.data.orderNo).toBeDefined()
      expect(result.data.orderNo).toMatch(/^SP\d+$/)
    })
  })

  // ---------- 用户接口测试 ----------

  describe('api.getProfile', () => {
    it('should return user profile', async () => {
      const result = await api.getProfile()
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveProperty('id')
      expect(result.data).toHaveProperty('name')
      expect(result.data).toHaveProperty('level')
      expect(result.data).toHaveProperty('points')
    })
  })

  describe('api.getBookings', () => {
    it('should return bookings list', async () => {
      const result = await api.getBookings()
      
      expect(result.success).toBe(true)
      expect(Array.isArray(result.data)).toBe(true)
    })
  })
})

// ==================== 日志记录器测试 ====================

describe('Logger', () => {
  it('should have all log methods', () => {
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('should not throw when logging', () => {
    expect(() => logger.info('test message')).not.toThrow()
    expect(() => logger.error('test error', new Error('test'))).not.toThrow()
    expect(() => logger.warn('test warning')).not.toThrow()
    expect(() => logger.debug('test debug')).not.toThrow()
  })

  it('should accept data parameter', () => {
    expect(() => logger.info('test', { key: 'value' })).not.toThrow()
  })
})
