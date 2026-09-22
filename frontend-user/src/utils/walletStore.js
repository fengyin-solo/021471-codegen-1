/**
 * 会员钱包与资产存储
 *
 * 功能说明：
 * - 集中管理余额、积分流水、优惠券、消费明细
 * - 余额与明细分开持久化：明细损坏不影响余额，余额损坏不牵连明细
 * - 支付幂等：同一任务只扣款一次，重复提交直接拒绝
 * - 任务支付原子化：先扣款记账、再更新任务状态，任务更新失败自动退款
 * - 对账自愈：返回个人中心时对齐金额与任务状态，绝不改写既有订单/预约/课程记录
 *
 * 使用方式：
 * import { walletState, walletStore, initWallet } from '@/utils/walletStore'
 */

import { reactive } from 'vue'
import { isAuthenticated, updateUser, authState } from './auth'
import { taskStore } from './taskStore'
import { logger } from './api'

// ==================== 常量定义 ====================

const BALANCE_KEY = 'billiard_wallet_balance_v1'
const LEDGER_KEY = 'billiard_wallet_ledger_v1'
const COUPONS_KEY = 'billiard_wallet_coupons_v1'
const INIT_KEY = 'billiard_wallet_seeded_v1'

/** 记录类型：asset 标识资产类别，direction 标识收支方向 */
const TX_TYPES = {
  recharge: { label: '余额充值', asset: 'money', direction: 'in' },
  consume: { label: '消费支付', asset: 'money', direction: 'out' },
  refund: { label: '退款入账', asset: 'money', direction: 'in' },
  points_earn: { label: '积分获取', asset: 'points', direction: 'in' },
  points_spend: { label: '积分兑换', asset: 'points', direction: 'out' },
  coupon_grant: { label: '优惠券发放', asset: 'coupon', direction: 'in' }
}

const TYPE_NAME_MAP = {
  booking: '球桌预约',
  course: '课程报名',
  competition: '赛事报名',
  order: '商城订单'
}

// ==================== 响应式状态 ====================

export const walletState = reactive({
  /** 钱包余额（元） */
  balance: 0,
  /** 资产明细（最新在前） */
  ledger: [],
  /** 优惠券列表 */
  coupons: [],
  /** 是否已初始化 */
  initialized: false,
  /** 明细存储是否发生过损坏（已隔离损坏记录） */
  ledgerCorrupted: false,
  /** 余额存储是否发生过损坏（已回退为安全默认值） */
  balanceCorrupted: false,
  /** 优惠券存储是否发生过损坏 */
  couponsCorrupted: false
})

/** 进行中的支付/充值/兑换任务，防止重复提交 */
const inFlight = new Set()

// ==================== 工具函数 ====================

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function formatDate(date) {
  const d = new Date(date)
  const pad = (n) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function generateTxnId() {
  return 'W' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0')
}

function notifyAuthExpired(reason) {
  logger.warn('Auth expired for wallet operation', { reason })
  window.dispatchEvent(new CustomEvent('billiard:auth-expired', { detail: { reason } }))
}

/** 校验单条明细记录是否完整，损坏记录将被隔离而不是渲染 */
function isValidRecord(record) {
  if (!record || typeof record !== 'object') return false
  if (typeof record.id !== 'string' || !record.id) return false
  if (!TX_TYPES[record.type]) return false
  if (typeof record.amount !== 'number' || !isFinite(record.amount) || record.amount <= 0) return false
  if (typeof record.createdAt !== 'string' || !record.createdAt) return false
  return true
}

// ==================== 持久化 ====================

function saveBalance() {
  try {
    localStorage.setItem(BALANCE_KEY, String(round2(walletState.balance)))
  } catch (e) {
    logger.error('保存余额失败', e)
  }
}

function saveLedger() {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(walletState.ledger))
  } catch (e) {
    logger.error('保存明细失败', e)
  }
}

function saveCoupons() {
  try {
    localStorage.setItem(COUPONS_KEY, JSON.stringify(walletState.coupons))
  } catch (e) {
    logger.error('保存优惠券失败', e)
  }
}

/**
 * 读取余额：余额损坏时回退为 0（由初始化种子补齐），绝不抛错
 */
function loadBalance() {
  const raw = localStorage.getItem(BALANCE_KEY)
  if (raw === null) return { value: null, corrupted: false }
  const value = Number(raw)
  if (!isFinite(value) || value < 0) {
    logger.warn('余额数据损坏，已忽略损坏值', raw)
    return { value: null, corrupted: true }
  }
  return { value: round2(value), corrupted: false }
}

/**
 * 读取明细：整体损坏返回空列表；单条损坏只隔离该条，其余正常展示
 */
function loadLedger() {
  const raw = localStorage.getItem(LEDGER_KEY)
  if (raw === null) return { records: null, corrupted: false }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    logger.error('消费明细整体损坏，已隔离', e)
    return { records: [], corrupted: true }
  }
  if (!Array.isArray(parsed)) {
    logger.error('消费明细结构损坏，已隔离')
    return { records: [], corrupted: true }
  }
  const valid = []
  let corrupted = false
  for (const item of parsed) {
    if (isValidRecord(item)) {
      valid.push(item)
    } else {
      corrupted = true
      logger.warn('已隔离一条损坏的明细记录', item)
    }
  }
  return { records: valid, corrupted }
}

function loadCoupons() {
  const raw = localStorage.getItem(COUPONS_KEY)
  if (raw === null) return { coupons: null, corrupted: false }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    logger.error('优惠券数据损坏，已隔离', e)
    return { coupons: [], corrupted: true }
  }
  if (!Array.isArray(parsed)) return { coupons: [], corrupted: true }
  const valid = []
  let corrupted = false
  for (const item of parsed) {
    if (item && typeof item === 'object' && item.id && item.name && isFinite(Number(item.amount))) {
      valid.push(item)
    } else {
      corrupted = true
      logger.warn('已隔离一张损坏的优惠券', item)
    }
  }
  return { coupons: valid, corrupted }
}

// ==================== 初始化种子 ====================

/**
 * 首次使用时，基于任务中心已有记录生成一致的演示资产：
 * 已支付类任务都有对应的消费流水与一笔足额充值，待付款任务不动。
 */
function seedIfNeeded() {
  if (localStorage.getItem(INIT_KEY)) return

  const tasks = taskStore.getAll()
  const paidTasks = tasks.filter(
    (t) => t.status !== 'pending_payment' && t.status !== 'cancelled' && Number(t.amount) > 0
  )
  const totalConsume = round2(paidTasks.reduce((sum, t) => sum + Number(t.amount), 0))
  const rechargeAmount = Math.max(5000, round2(totalConsume + 1000))

  // 按时间从早到晚构建，稍后逐条写入余额快照
  const chrono = [
    {
      type: 'recharge',
      amount: rechargeAmount,
      title: '会员钱包充值',
      createdAt: '2026-01-01 09:00'
    }
  ]

  const ordered = [...paidTasks].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  for (const task of ordered) {
    chrono.push({
      type: 'consume',
      amount: round2(task.amount),
      title: `${TYPE_NAME_MAP[task.type] || task.typeName} · ${task.title}`,
      refType: task.type,
      refId: task.id,
      orderNo: task.extra?.orderNo || '',
      createdAt: task.createdAt
    })
  }

  // 历史积分与优惠券演示记录
  chrono.push({ type: 'points_earn', amount: 500, title: '比赛获奖积分', createdAt: '2026-01-20 15:30' })
  chrono.push({ type: 'points_spend', amount: 200, title: '积分兑换 10元无门槛券', createdAt: '2026-02-05 10:00' })
  chrono.push({ type: 'coupon_grant', amount: 10, title: '10元无门槛券', createdAt: '2026-02-05 10:00' })
  chrono.push({ type: 'points_earn', amount: 50, title: '预约消费奖励积分', createdAt: '2026-02-10 20:00' })

  // 写入余额快照
  let running = 0
  for (const entry of chrono) {
    const cfg = TX_TYPES[entry.type]
    if (cfg.asset === 'money') {
      running = round2(running + (cfg.direction === 'in' ? entry.amount : -entry.amount))
      entry.balanceAfter = running
    }
    entry.id = generateTxnId()
    entry.asset = cfg.asset
    entry.direction = cfg.direction
    entry.status = 'settled'
  }

  chrono.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  walletState.ledger.splice(0, walletState.ledger.length, ...chrono)
  walletState.balance = round2(running)

  walletState.coupons.splice(
    0,
    walletState.coupons.length,
    {
      id: 'CP001',
      name: '10元无门槛券',
      amount: 10,
      minSpend: 0,
      expireDate: '2026-12-31',
      source: '积分兑换',
      used: false,
      createdAt: '2026-02-05 10:00'
    },
    {
      id: 'CP002',
      name: '满1000减100券',
      amount: 100,
      minSpend: 1000,
      expireDate: '2026-12-31',
      source: '会员权益',
      used: false,
      createdAt: '2026-01-10 09:00'
    },
    {
      id: 'CP003',
      name: '满3000减300券',
      amount: 300,
      minSpend: 3000,
      expireDate: '2026-12-31',
      source: '会员权益',
      used: false,
      createdAt: '2026-01-10 09:00'
    }
  )

  saveBalance()
  saveLedger()
  saveCoupons()
  try {
    localStorage.setItem(INIT_KEY, '1')
  } catch (e) {
    logger.error('写入初始化标记失败', e)
  }
  logger.info('钱包初始化完成', { balance: walletState.balance, records: walletState.ledger.length })
}

// ==================== 内部记账 ====================

function appendRecord(entry) {
  const cfg = TX_TYPES[entry.type]
  const record = {
    id: generateTxnId(),
    type: entry.type,
    asset: cfg.asset,
    direction: cfg.direction,
    amount: round2(entry.amount),
    title: entry.title,
    refType: entry.refType || '',
    refId: entry.refId || '',
    orderNo: entry.orderNo || '',
    status: 'settled',
    createdAt: entry.createdAt || formatDate(new Date()),
    balanceAfter: null
  }

  if (cfg.asset === 'money') {
    const delta = cfg.direction === 'in' ? record.amount : -record.amount
    walletState.balance = round2(walletState.balance + delta)
    record.balanceAfter = walletState.balance
  }

  walletState.ledger.unshift(record)
  saveLedger()
  if (cfg.asset === 'money') saveBalance()
  return record
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ==================== 对外接口 ====================

export const walletStore = {
  /** 记录类型配置（供 UI 展示文案） */
  TX_TYPES,

  /**
   * 初始化钱包，应用启动时调用一次
   */
  init() {
    if (walletState.initialized) return

    const balanceData = loadBalance()
    const ledgerData = loadLedger()
    const couponData = loadCoupons()

    walletState.balanceCorrupted = balanceData.corrupted
    walletState.ledgerCorrupted = ledgerData.corrupted
    walletState.couponsCorrupted = couponData.corrupted

    if (ledgerData.records) walletState.ledger.splice(0, walletState.ledger.length, ...ledgerData.records)
    if (couponData.coupons) walletState.coupons.splice(0, walletState.coupons.length, ...couponData.coupons)

    if (balanceData.value !== null) {
      walletState.balance = balanceData.value
    } else if (!balanceData.corrupted) {
      // 全新用户：种子演示数据
      seedIfNeeded()
    } else {
      // 余额损坏：以 0 为准并立即落盘，不根据明细重算，避免脏数据放大
      walletState.balance = 0
      saveBalance()
    }

    walletState.initialized = true
    logger.info('钱包状态已加载', {
      balance: walletState.balance,
      records: walletState.ledger.length,
      coupons: walletState.coupons.length
    })
  },

  /**
   * 按类型筛选明细
   * @param {'all'|'money'|'points'|'coupon'} assetType
   */
  getRecords(assetType = 'all') {
    const records = [...walletState.ledger].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )
    if (assetType === 'all') return records
    return records.filter((r) => r.asset === assetType)
  },

  getUsableCoupons() {
    return walletState.coupons.filter((c) => !c.used)
  },

  /** 某任务是否已有成功扣款（幂等判断） */
  hasPayment(taskId) {
    return walletState.ledger.some((r) => r.type === 'consume' && r.refId === taskId && r.status === 'settled')
  },

  /**
   * 使用钱包余额支付任务中心的待付款任务
   *
   * 一致性保证：
   * - 登录失效：拒绝并广播事件，不产生任何变动
   * - 余额不足：拒绝，不扣款、任务状态不变
   * - 重复提交/已支付：幂等拒绝，只扣一次款
   * - 扣款后任务更新失败：自动退款并保留两条流水
   *
   * @returns {Promise<{success:boolean, code?:string, message?:string, txn?:Object, balanceAfter?:number}>}
   */
  async payForTask(task) {
    if (!isAuthenticated()) {
      notifyAuthExpired('pay')
      return { success: false, code: 'AUTH_EXPIRED', message: '登录状态已失效，请重新登录' }
    }
    if (!task || !task.id) {
      return { success: false, code: 'INVALID_TASK', message: '任务信息不完整' }
    }

    // 第一道防重：进行中的支付
    if (inFlight.has(task.id)) {
      logger.warn('支付请求重复提交，已拦截', { taskId: task.id })
      return { success: false, code: 'DUPLICATE_SUBMIT', message: '正在处理中，请勿重复提交' }
    }

    // 第二道防重：已存在成功扣款流水
    if (this.hasPayment(task.id)) {
      logger.warn('任务已支付，重复支付已拦截', { taskId: task.id })
      return { success: false, code: 'ALREADY_PAID', message: '该订单已支付，请勿重复提交' }
    }

    // 以存储中的最新任务为准，避免用旧快照支付已取消/已付款任务
    const fresh = taskStore.getById(task.id)
    if (!fresh) {
      return { success: false, code: 'TASK_NOT_FOUND', message: '任务不存在或已被取消' }
    }
    if (fresh.status !== 'pending_payment') {
      return { success: false, code: 'ALREADY_PAID', message: '该订单已支付，请勿重复提交' }
    }

    const amount = round2(fresh.amount)
    if (!isFinite(amount) || amount <= 0) {
      return { success: false, code: 'INVALID_AMOUNT', message: '订单金额异常，无法支付' }
    }
    if (walletState.balance < amount) {
      logger.warn('余额不足，支付已拦截', { taskId: task.id, amount, balance: walletState.balance })
      return {
        success: false,
        code: 'INSUFFICIENT_BALANCE',
        message: `余额不足，还差 ¥${round2(amount - walletState.balance).toLocaleString()}`,
        balanceAfter: walletState.balance
      }
    }

    inFlight.add(task.id)
    try {
      // 模拟支付网关
      await delay(800)

      // 网关返回后再次校验，覆盖等待期间任务状态/余额变化
      const recheck = taskStore.getById(task.id)
      if (!recheck) {
        return { success: false, code: 'TASK_NOT_FOUND', message: '任务不存在或已被取消' }
      }
      if (this.hasPayment(task.id)) {
        return { success: false, code: 'ALREADY_PAID', message: '该订单已支付，请勿重复提交' }
      }
      if (recheck.status !== 'pending_payment') {
        return { success: false, code: 'ALREADY_PAID', message: '该订单已支付，请勿重复提交' }
      }
      if (walletState.balance < amount) {
        return {
          success: false,
          code: 'INSUFFICIENT_BALANCE',
          message: `余额不足，还差 ¥${round2(amount - walletState.balance).toLocaleString()}`,
          balanceAfter: walletState.balance
        }
      }

      // 第一步：扣款并记录流水
      const txn = appendRecord({
        type: 'consume',
        amount,
        title: `${TYPE_NAME_MAP[fresh.type] || fresh.typeName} · ${fresh.title}`,
        refType: fresh.type,
        refId: fresh.id,
        orderNo: fresh.extra?.orderNo || ''
      })

      // 第二步：任务状态置为已支付（仅状态流转，不改写业务记录）
      const updated = taskStore.markAsPaid(task.id)
      if (!updated) {
        // 任务状态更新失败：自动退款，资金与任务保持一致
        appendRecord({
          type: 'refund',
          amount,
          title: `${TYPE_NAME_MAP[fresh.type] || fresh.typeName} · 支付异常自动退回`,
          refType: fresh.type,
          refId: fresh.id,
          orderNo: fresh.extra?.orderNo || ''
        })
        logger.error('任务状态更新失败，已自动退款', { taskId: task.id, amount })
        return { success: false, code: 'TASK_UPDATE_FAILED', message: '支付确认失败，款项已自动退回' }
      }

      logger.info('钱包支付成功', { taskId: task.id, amount, balanceAfter: txn.balanceAfter })
      return { success: true, txn, balanceAfter: txn.balanceAfter }
    } finally {
      inFlight.delete(task.id)
    }
  },

  /**
   * 钱包充值（模拟）
   */
  async recharge(amount) {
    if (!isAuthenticated()) {
      notifyAuthExpired('recharge')
      return { success: false, code: 'AUTH_EXPIRED', message: '登录状态已失效，请重新登录' }
    }
    const value = round2(amount)
    if (!isFinite(value) || value < 1 || value > 50000) {
      return { success: false, code: 'INVALID_AMOUNT', message: '充值金额需在 1 ~ 50000 元之间' }
    }
    if (inFlight.has('recharge')) {
      return { success: false, code: 'DUPLICATE_SUBMIT', message: '正在处理中，请勿重复提交' }
    }
    inFlight.add('recharge')
    try {
      await delay(600)
      const txn = appendRecord({ type: 'recharge', amount: value, title: '会员钱包充值' })
      logger.info('钱包充值成功', { amount: value, balanceAfter: txn.balanceAfter })
      return { success: true, txn, balanceAfter: txn.balanceAfter }
    } finally {
      inFlight.delete('recharge')
    }
  },

  /**
   * 积分兑换礼品：扣减积分并持久化；含优惠券的礼品同步发券并记账
   */
  async exchangePoints(gift) {
    if (!isAuthenticated()) {
      notifyAuthExpired('exchange')
      return { success: false, code: 'AUTH_EXPIRED', message: '登录状态已失效，请重新登录' }
    }
    if (!gift || !isFinite(Number(gift.points)) || gift.points <= 0) {
      return { success: false, code: 'INVALID_GIFT', message: '礼品信息异常' }
    }
    if (inFlight.has('exchange')) {
      return { success: false, code: 'DUPLICATE_SUBMIT', message: '正在处理中，请勿重复提交' }
    }

    const currentPoints = Number(authState.user?.points || 0)
    if (currentPoints < gift.points) {
      return { success: false, code: 'INSUFFICIENT_POINTS', message: '积分不足，无法兑换' }
    }

    inFlight.add('exchange')
    try {
      await delay(500)

      // 返回后二次校验积分，防止等待期间变化
      if (Number(authState.user?.points || 0) < gift.points) {
        return { success: false, code: 'INSUFFICIENT_POINTS', message: '积分不足，无法兑换' }
      }

      const pointsAfter = currentPoints - gift.points
      updateUser({ points: pointsAfter })
      appendRecord({ type: 'points_spend', amount: gift.points, title: `积分兑换 · ${gift.name}` })

      let coupon = null
      if (gift.coupon) {
        coupon = {
          id: 'CP' + Date.now().toString() + Math.floor(Math.random() * 100),
          name: gift.coupon.name,
          amount: gift.coupon.amount,
          minSpend: gift.coupon.minSpend || 0,
          expireDate: '2026-12-31',
          source: '积分兑换',
          used: false,
          createdAt: formatDate(new Date())
        }
        walletState.coupons.unshift(coupon)
        saveCoupons()
        appendRecord({ type: 'coupon_grant', amount: coupon.amount, title: coupon.name })
      }

      logger.info('积分兑换成功', { gift: gift.name, pointsAfter })
      return { success: true, pointsAfter, coupon }
    } finally {
      inFlight.delete('exchange')
    }
  },

  /**
   * 对账：返回个人中心时调用，确保金额与任务状态一致
   *
   * 处理三类不一致：
   * 1. 已扣款但任务仍待付款（支付中断）→ 将任务状态对齐为已支付
   * 2. 任务已不存在但有扣款（取消前已扣款）→ 自动退款
   * 3. 同一任务重复扣款 → 保留最早一笔，其余自动退款
   *
   * 注意：不会反向补扣「已支付但无钱包流水」的历史任务，
   * 也不会改动任何既有订单、预约、课程记录。
   *
   * @returns {{healed: string[], refunds: number[], duplicateRefunds: number}}
   */
  reconcile() {
    const healed = []
    const refunds = []
    let duplicateRefunds = 0

    const tasks = taskStore.getAll()
    // 已冲正的消费记录不再参与对账，避免重复退款
    const consumeRecords = walletState.ledger.filter(
      (r) => r.type === 'consume' && r.status !== 'reversed'
    )

    // 按任务归组扣款流水
    const grouped = new Map()
    for (const record of consumeRecords) {
      if (!record.refId) continue
      if (!grouped.has(record.refId)) grouped.set(record.refId, [])
      grouped.get(record.refId).push(record)
    }

    for (const [taskId, records] of grouped.entries()) {
      const sorted = [...records].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      const [first, ...duplicates] = sorted

      // 重复扣款：保留原记录用于审计，但标记为已冲正（不再计为有效消费），并退回款项
      for (const dup of duplicates) {
        dup.status = 'reversed'
        const refund = appendRecord({
          type: 'refund',
          amount: dup.amount,
          title: '重复扣款自动退回',
          refType: dup.refType,
          refId: taskId,
          orderNo: dup.orderNo
        })
        refunds.push(refund.id)
        duplicateRefunds++
        logger.warn('检测到重复扣款，已自动退回', { taskId, amount: dup.amount })
      }

      const task = tasks.find((t) => t.id === taskId)
      if (!task) {
        // 任务已不存在（已取消/删除）却有扣款 → 退款
        const refund = appendRecord({
          type: 'refund',
          amount: first.amount,
          title: '任务已取消，款项自动退回',
          refType: first.refType,
          refId: taskId,
          orderNo: first.orderNo
        })
        refunds.push(refund.id)
        logger.warn('检测到已扣款任务被取消，已自动退款', { taskId, amount: first.amount })
      } else if (task.status === 'pending_payment') {
        // 钱已扣、任务仍待付款 → 对齐任务状态（不重复扣款）
        const updated = taskStore.markAsPaid(taskId)
        if (updated) {
          healed.push(taskId)
          logger.warn('检测到扣款成功但任务状态未更新，已自动对齐', { taskId })
        }
      }
    }

    if (healed.length || refunds.length) {
      logger.info('钱包对账完成', { healed, refunds, duplicateRefunds })
    }
    return { healed, refunds, duplicateRefunds }
  },

  /**
   * 测试/重置用：清空内存状态与持久化数据
   * @private
   */
  reset() {
    walletState.balance = 0
    walletState.ledger.splice(0, walletState.ledger.length)
    walletState.coupons.splice(0, walletState.coupons.length)
    walletState.initialized = false
    walletState.ledgerCorrupted = false
    walletState.balanceCorrupted = false
    walletState.couponsCorrupted = false
    inFlight.clear()
    ;[BALANCE_KEY, LEDGER_KEY, COUPONS_KEY, INIT_KEY].forEach((key) => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        /* ignore */
      }
    })
  }
}

export default walletStore
