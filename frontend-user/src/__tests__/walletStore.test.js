/**
 * 会员钱包模块单元测试
 *
 * 测试范围：
 * - 初始化与演示数据一致性
 * - 余额支付：登录失效 / 余额不足 / 重复提交 / 幂等 / 失败退款
 * - 充值与积分兑换（含发券）
 * - 对账自愈：中断恢复、任务取消自动退款、重复扣款退款
 * - 数据损坏隔离：余额损坏、明细整体损坏、单条明细损坏
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage（不重置的全局对象，每个用例手动清空）
const store = {}
const localStorageMock = {
  getItem: vi.fn((key) => (key in store ? store[key] : null)),
  setItem: vi.fn((key, value) => { store[key] = String(value) }),
  removeItem: vi.fn((key) => { delete store[key] }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]) })
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, configurable: true })

// 可控登录态与用户信息（vi.mock 工厂会被提升，需用 vi.hoisted 声明共享对象）
const { authStateStub, isAuthenticatedMock, taskStoreMock, tasksTableRef } = vi.hoisted(() => {
  const tasksTableRef = { current: [] }
  return {
    tasksTableRef,
    authStateStub: { user: { id: 'U20260001', name: '张三', points: 2580 }, token: 't', isLoggedIn: true },
    isAuthenticatedMock: vi.fn(() => true),
    taskStoreMock: {
      getAll: vi.fn(() => tasksTableRef.current.map((t) => ({ ...t, extra: { ...t.extra } }))),
      getById: vi.fn((id) => {
        const t = tasksTableRef.current.find((x) => x.id === id)
        return t ? { ...t, extra: { ...t.extra } } : null
      }),
      markAsPaid: vi.fn((id) => {
        const t = tasksTableRef.current.find((x) => x.id === id)
        if (!t) return null
        t.status = t.type === 'order' ? 'pending_shipment' : 'upcoming'
        return { ...t }
      })
    }
  }
})

vi.mock('../utils/auth', () => ({
  isAuthenticated: isAuthenticatedMock,
  updateUser: vi.fn((updates) => {
    if (authStateStub.user) Object.assign(authStateStub.user, updates)
    return authStateStub.user
  }),
  authState: authStateStub
}))

vi.mock('../utils/taskStore', () => ({
  taskStore: taskStoreMock
}))

// api 的 logger 仅输出日志，直接 mock 掉
vi.mock('../utils/api', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import { walletState, walletStore } from '../utils/walletStore'
import { isAuthenticated } from '../utils/auth'

// 构造一笔待付款任务
function makePendingTask(overrides = {}) {
  return {
    id: 'TASK_' + Math.random().toString(36).slice(2),
    type: 'booking',
    typeName: '球桌预约',
    title: '3号球桌 - 美式九球',
    amount: 120,
    status: 'pending_payment',
    createdAt: '2026-02-14 10:00',
    extra: { orderNo: 'BK0001' },
    ...overrides
  }
}

async function freshWallet(taskSetup = []) {
  localStorageMock.clear()
  tasksTableRef.current = taskSetup.map((t) => ({ ...t }))
  walletStore.reset()
  walletStore.init()
}

describe('Wallet Store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAuthenticatedMock.mockReturnValue(true)
    isAuthenticated.mockReturnValue(true)
    authStateStub.user = { id: 'U20260001', name: '张三', points: 2580 }
  })

  describe('初始化', () => {
    it('首次使用时基于任务中心生成余额、明细和优惠券', () => {
      const pending = makePendingTask()
      const paidCourse = makePendingTask({ id: 'PAID1', type: 'course', amount: 599, status: 'upcoming', createdAt: '2026-02-10 09:00' })
      freshWallet([pending, paidCourse])

      expect(walletState.initialized).toBe(true)
      // 已支付任务 599 + 保底充值至少 1000 余量 => 余额充足
      expect(walletState.balance).toBeGreaterThanOrEqual(1000)
      expect(walletState.coupons.length).toBe(3)
      // 已支付课程有对应消费流水，待付款任务没有
      expect(walletState.ledger.some((r) => r.type === 'consume' && r.refId === 'PAID1')).toBe(true)
      expect(walletState.ledger.some((r) => r.type === 'consume' && r.refId === pending.id)).toBe(false)
    })

    it('已有持久化数据时直接恢复，不重复播种', () => {
      freshWallet([])
      const balanceBefore = walletState.balance
      const recordsBefore = walletState.ledger.length

      walletState.initialized = false
      walletStore.init()

      expect(walletState.balance).toBe(balanceBefore)
      expect(walletState.ledger.length).toBe(recordsBefore)
    })
  })

  describe('payForTask - 异常拦截', () => {
    it('登录失效时拒绝支付并广播事件，金额与任务不变', async () => {
      freshWallet([])
      const task = makePendingTask()
      tasksTableRef.current = [task]
      isAuthenticated.mockReturnValue(false)

      let eventDetail = null
      const handler = (e) => { eventDetail = e.detail }
      window.addEventListener('billiard:auth-expired', handler)

      const result = await walletStore.payForTask(task)

      expect(result.success).toBe(false)
      expect(result.code).toBe('AUTH_EXPIRED')
      expect(eventDetail).toBeTruthy()
      expect(tasksTableRef.current[0].status).toBe('pending_payment')

      window.removeEventListener('billiard:auth-expired', handler)
    })

    it('余额不足时不扣款且任务状态不变', async () => {
      freshWallet([])
      // 无播种数据时余额为 0
      walletState.balance = 50
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]

      const result = await walletStore.payForTask(task)

      expect(result.success).toBe(false)
      expect(result.code).toBe('INSUFFICIENT_BALANCE')
      expect(walletState.balance).toBe(50)
      expect(tasksTableRef.current[0].status).toBe('pending_payment')
    })

    it('并发重复提交只扣一次款', async () => {
      freshWallet([])
      walletState.balance = 500
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]

      const [r1, r2] = await Promise.all([
        walletStore.payForTask(task),
        walletStore.payForTask(task)
      ])

      const success = [r1, r2].filter((r) => r.success)
      const blocked = [r1, r2].filter((r) => !r.success)
      expect(success.length).toBe(1)
      expect(blocked[0].code).toBe('DUPLICATE_SUBMIT')
      expect(walletState.balance).toBe(380)
      expect(walletState.ledger.filter((r) => r.type === 'consume' && r.refId === task.id).length).toBe(1)
    })

    it('任务已有扣款流水时幂等拒绝', async () => {
      freshWallet([])
      walletState.balance = 500
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]

      const first = await walletStore.payForTask(task)
      expect(first.success).toBe(true)
      // 模拟旧快照仍显示待付款
      const staleSnapshot = { ...task, status: 'pending_payment' }
      const second = await walletStore.payForTask(staleSnapshot)

      expect(second.success).toBe(false)
      expect(second.code).toBe('ALREADY_PAID')
      expect(walletState.balance).toBe(380)
    })
  })

  describe('payForTask - 成功与回滚', () => {
    it('支付成功：扣款、写流水、任务状态流转，且余额快照正确', async () => {
      freshWallet([])
      walletState.balance = 500
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]

      const result = await walletStore.payForTask(task)

      expect(result.success).toBe(true)
      expect(walletState.balance).toBe(380)
      expect(result.balanceAfter).toBe(380)
      expect(tasksTableRef.current[0].status).toBe('upcoming')
      const txn = walletState.ledger.find((r) => r.type === 'consume' && r.refId === task.id)
      expect(txn).toBeTruthy()
      expect(txn.balanceAfter).toBe(380)
    })

    it('扣款后任务状态更新失败时自动退款', async () => {
      freshWallet([])
      walletState.balance = 500
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]

      // markAsPaid 首次失败
      taskStoreMock.markAsPaid.mockImplementationOnce(() => null)

      const result = await walletStore.payForTask(task)

      expect(result.success).toBe(false)
      expect(result.code).toBe('TASK_UPDATE_FAILED')
      expect(walletState.balance).toBe(500)
      expect(tasksTableRef.current[0].status).toBe('pending_payment')
      expect(walletState.ledger.some((r) => r.type === 'consume' && r.refId === task.id)).toBe(true)
      expect(walletState.ledger.some((r) => r.type === 'refund' && r.refId === task.id)).toBe(true)
    })
  })

  describe('充值与积分兑换', () => {
    it('充值成功增加余额并写入充值流水', async () => {
      freshWallet([])
      walletState.balance = 100
      const result = await walletStore.recharge(500)
      expect(result.success).toBe(true)
      expect(walletState.balance).toBe(600)
      expect(walletState.ledger.some((r) => r.type === 'recharge' && r.amount === 500)).toBe(true)
    })

    it('充值金额非法时被拒绝', async () => {
      freshWallet([])
      walletState.balance = 100
      const result = await walletStore.recharge(0)
      expect(result.success).toBe(false)
      expect(result.code).toBe('INVALID_AMOUNT')
      expect(walletState.balance).toBe(100)
    })

    it('积分兑换优惠券：扣减积分、发券并写两条流水', async () => {
      freshWallet([])
      const gift = { id: 1, name: '10元无门槛优惠券', points: 200, coupon: { name: '10元无门槛券', amount: 10, minSpend: 0 } }
      const result = await walletStore.exchangePoints(gift)

      expect(result.success).toBe(true)
      expect(result.pointsAfter).toBe(2380)
      expect(result.coupon).toBeTruthy()
      expect(walletState.coupons.some((c) => c.name === '10元无门槛券')).toBe(true)
      expect(walletState.ledger.some((r) => r.type === 'points_spend' && r.amount === 200)).toBe(true)
      expect(walletState.ledger.some((r) => r.type === 'coupon_grant' && r.amount === 10)).toBe(true)
    })

    it('积分不足时拒绝兑换，积分与优惠券均不变', async () => {
      freshWallet([])
      authStateStub.user.points = 100
      const couponsBefore = walletState.coupons.length
      const gift = { id: 1, name: '大礼', points: 200 }
      const result = await walletStore.exchangePoints(gift)

      expect(result.success).toBe(false)
      expect(result.code).toBe('INSUFFICIENT_POINTS')
      expect(authStateStub.user.points).toBe(100)
      expect(walletState.coupons.length).toBe(couponsBefore)
    })
  })

  describe('reconcile - 对账自愈', () => {
    it('已扣款但任务仍待付款：对齐任务状态（不重复扣款）', () => {
      freshWallet([])
      walletState.balance = 500
      const task = makePendingTask({ amount: 120 })
      tasksTableRef.current = [task]
      // 模拟支付中断：已扣款但任务状态未更新
      walletState.ledger.unshift({
        id: 'X1', type: 'consume', asset: 'money', direction: 'out',
        amount: 120, title: '消费', refType: 'booking', refId: task.id,
        status: 'settled', createdAt: '2026-02-14 11:00', balanceAfter: 380
      })

      const result = walletStore.reconcile()

      expect(result.healed).toContain(task.id)
      expect(tasksTableRef.current[0].status).toBe('upcoming')
      expect(walletState.ledger.filter((r) => r.type === 'consume' && r.refId === task.id).length).toBe(1)
    })

    it('任务已不存在但有扣款：自动退款', () => {
      freshWallet([])
      walletState.balance = 100
      walletState.ledger.unshift({
        id: 'X2', type: 'consume', asset: 'money', direction: 'out',
        amount: 120, title: '消费', refType: 'booking', refId: 'GONE_TASK',
        status: 'settled', createdAt: '2026-02-14 11:00', balanceAfter: 100
      })

      const result = walletStore.reconcile()

      expect(result.refunds.length).toBe(1)
      expect(walletState.balance).toBe(220)
      expect(walletState.ledger.some((r) => r.type === 'refund' && r.refId === 'GONE_TASK')).toBe(true)
    })

    it('同一任务重复扣款：保留一笔，其余退回', () => {
      freshWallet([])
      walletState.balance = 260
      const task = makePendingTask({ amount: 120, status: 'upcoming' })
      tasksTableRef.current = [task]
      walletState.ledger.unshift(
        { id: 'D1', type: 'consume', asset: 'money', direction: 'out', amount: 120, title: '消费', refType: 'booking', refId: task.id, status: 'settled', createdAt: '2026-02-14 11:00', balanceAfter: 380 },
        { id: 'D2', type: 'consume', asset: 'money', direction: 'out', amount: 120, title: '消费', refType: 'booking', refId: task.id, status: 'settled', createdAt: '2026-02-14 11:01', balanceAfter: 260 }
      )

      const result = walletStore.reconcile()

      expect(result.duplicateRefunds).toBe(1)
      // 保留两条消费记录作为审计痕迹，但只有一笔为有效（settled），另一笔已冲正
      const consumeRecords = walletState.ledger.filter((r) => r.type === 'consume' && r.refId === task.id)
      expect(consumeRecords.filter((r) => r.status === 'settled').length).toBe(1)
      expect(consumeRecords.filter((r) => r.status === 'reversed').length).toBe(1)
      expect(walletState.ledger.filter((r) => r.type === 'refund' && r.refId === task.id).length).toBe(1)
      expect(walletState.balance).toBe(380)

      // 再次对账必须幂等：不产生新的退款
      const second = walletStore.reconcile()
      expect(second.refunds.length).toBe(0)
      expect(second.duplicateRefunds).toBe(0)
      expect(walletState.balance).toBe(380)
    })
  })

  describe('数据损坏隔离', () => {
    it('余额存储损坏：回退为 0 且不抛错，不依据明细重算', () => {
      localStorageMock.clear()
      tasksTableRef.current = []
      walletStore.reset()
      store['billiard_wallet_balance_v1'] = 'NOT_A_NUMBER'
      store['billiard_wallet_ledger_v1'] = JSON.stringify([
        { id: 'L1', type: 'recharge', amount: 999, title: 'x', createdAt: '2026-02-14 11:00' }
      ])

      expect(() => walletStore.init()).not.toThrow()
      expect(walletState.balance).toBe(0)
      expect(walletState.balanceCorrupted).toBe(true)
      // 有效明细仍然可读
      expect(walletState.ledger.length).toBe(1)
    })

    it('明细整体损坏：余额保持不变，明细置空并标记', () => {
      localStorageMock.clear()
      tasksTableRef.current = []
      walletStore.reset()
      store['billiard_wallet_balance_v1'] = '888.5'
      store['billiard_wallet_ledger_v1'] = '{broken json'

      walletStore.init()

      expect(walletState.balance).toBe(888.5)
      expect(walletState.ledger).toEqual([])
      expect(walletState.ledgerCorrupted).toBe(true)
    })

    it('单条明细损坏：只隔离坏记录，其余正常展示', () => {
      localStorageMock.clear()
      tasksTableRef.current = []
      walletStore.reset()
      store['billiard_wallet_balance_v1'] = '100'
      store['billiard_wallet_ledger_v1'] = JSON.stringify([
        { id: 'GOOD', type: 'recharge', amount: 100, title: 'ok', createdAt: '2026-02-14 11:00' },
        { id: 'BAD', type: 'unknown_type', amount: 50, title: 'bad', createdAt: '2026-02-14 12:00' },
        { id: 'BAD2', type: 'consume', amount: -10, title: 'neg', createdAt: '2026-02-14 13:00' }
      ])

      walletStore.init()

      expect(walletState.ledger.length).toBe(1)
      expect(walletState.ledger[0].id).toBe('GOOD')
      expect(walletState.ledgerCorrupted).toBe(true)
    })
  })

  describe('按类型查看记录', () => {
    it('getRecords 支持按资产类型筛选', () => {
      const paidCourse = makePendingTask({ id: 'PAIDC', type: 'course', amount: 599, status: 'upcoming', createdAt: '2026-02-10 09:00' })
      freshWallet([paidCourse])

      const moneyRecords = walletStore.getRecords('money')
      const pointsRecords = walletStore.getRecords('points')
      const couponRecords = walletStore.getRecords('coupon')

      expect(moneyRecords.every((r) => r.asset === 'money')).toBe(true)
      expect(pointsRecords.length).toBeGreaterThan(0)
      expect(pointsRecords.every((r) => r.asset === 'points')).toBe(true)
      expect(couponRecords.every((r) => r.asset === 'coupon')).toBe(true)
      expect(walletStore.getRecords('all').length).toBe(
        moneyRecords.length + pointsRecords.length + couponRecords.length
      )
    })
  })
})
