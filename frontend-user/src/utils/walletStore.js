/**
 * 会员钱包与资产存储
 * 使用只追加的交易明细推导余额和积分，支付任务时先入账、再提交任务状态。
 */
import { authState, syncUserAssets } from './auth'
import { logger } from './api'

const WALLET_STORAGE_PREFIX = 'billiard_wallet_'
const DEFAULT_BALANCE = 368
const DEFAULT_POINTS = 2580

const activeTaskPayments = new Map()
const activeExchanges = new Set()

export const PAYMENT_RESULT = {
  OK: 'OK',
  RECOVERED: 'RECOVERED',
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  INVALID_TASK: 'INVALID_TASK',
  INVALID_REQUEST: 'INVALID_REQUEST',
  DUPLICATE_SUBMISSION: 'DUPLICATE_SUBMISSION',
  ALREADY_PAID: 'ALREADY_PAID',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  CORRUPTED_LEDGER: 'CORRUPTED_LEDGER',
  COMMIT_FAILED: 'COMMIT_FAILED',
  SAVE_FAILED: 'SAVE_FAILED',
  LOCKED: 'LOCKED'
}

export const transactionTypeConfig = {
  recharge: { label: '余额充值', category: 'balance', sign: 1 },
  expense: { label: '消费扣款', category: 'consumption', sign: -1 },
  refund: { label: '消费退款', category: 'balance', sign: 1 },
  points_earn: { label: '积分获取', category: 'points', sign: 1 },
  points_spend: { label: '积分兑换', category: 'points', sign: -1 },
  coupon_grant: { label: '优惠券发放', category: 'coupon', sign: 0 },
  coupon_use: { label: '优惠券使用', category: 'coupon', sign: 0 }
}

export const couponGifts = [
  {
    id: 'coupon-10',
    kind: 'coupon',
    name: '10元优惠券',
    icon: '🎫',
    points: 200,
    coupon: { name: '10元优惠券', discount: 10, minSpend: 100, validDays: 90 }
  },
  {
    id: 'coupon-20',
    kind: 'coupon',
    name: '20元优惠券',
    icon: '🎟️',
    points: 400,
    coupon: { name: '20元优惠券', discount: 20, minSpend: 300, validDays: 90 }
  },
  {
    id: 'coupon-hour',
    kind: 'coupon',
    name: '1小时免费打球券',
    icon: '🎱',
    points: 500,
    coupon: { name: '1小时免费打球券', discount: 60, minSpend: 0, validDays: 60 }
  },
  {
    id: 'coupon-50',
    kind: 'coupon',
    name: '50元专属优惠券',
    icon: '💎',
    points: 800,
    coupon: { name: '50元专属优惠券', discount: 50, minSpend: 500, validDays: 90 }
  }
]

function storageKey(userId) {
  return `${WALLET_STORAGE_PREFIX}${userId}`
}

function nowText() {
  return formatDateTime(new Date())
}

function formatDateTime(date) {
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function dateText(date) {
  return formatDateTime(date).slice(0, 10)
}

function createId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`
}

function isPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isValidDateText(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidTransaction(tx) {
  if (!isPlainObject(tx)) return false
  const config = transactionTypeConfig[tx.type]
  if (!config) return false
  if (typeof tx.id !== 'string' || !tx.id.trim()) return false
  if (typeof tx.title !== 'string' || !tx.title.trim()) return false
  if (!isValidDateText(tx.date)) return false
  if (!['processing', 'posted', 'failed'].includes(tx.status)) return false
  if (!isPositiveNumber(tx.amount)) return false
  if (tx.type.startsWith('points_') && !Number.isSafeInteger(tx.amount)) return false
  if (tx.type.startsWith('coupon_') && !Number.isSafeInteger(tx.amount)) return false
  if (tx.taskId !== undefined && typeof tx.taskId !== 'string') return false
  if (tx.idempotencyKey !== undefined && typeof tx.idempotencyKey !== 'string') return false
  if (tx.extra !== undefined && tx.extra !== null && !isPlainObject(tx.extra)) return false
  return true
}

function isValidCoupon(coupon) {
  if (!isPlainObject(coupon)) return false
  return (
    typeof coupon.id === 'string' &&
    coupon.id.trim() &&
    typeof coupon.name === 'string' &&
    coupon.name.trim() &&
    Number.isSafeInteger(coupon.discount) &&
    coupon.discount > 0 &&
    Number.isFinite(coupon.minSpend) &&
    coupon.minSpend >= 0 &&
    isValidDateText(coupon.grantedAt) &&
    isValidDateText(coupon.expireAt) &&
    ['active', 'used', 'expired'].includes(coupon.status)
  )
}

function backupCorrupted(key, raw, reason) {
  try {
    const backupKey = `${key}_corrupt_${Date.now()}`
    localStorage.setItem(backupKey, typeof raw === 'string' ? raw : JSON.stringify(raw))
    logger.warn('钱包明细已隔离备份', { key, backupKey, reason })
  } catch (error) {
    logger.error('损坏钱包明细备份失败', error)
  }
}

function readStoredWallet(userId) {
  const key = storageKey(userId)
  let raw = null
  try {
    raw = localStorage.getItem(key)
  } catch (error) {
    logger.error('读取钱包失败', error)
    return { ok: false, code: PAYMENT_RESULT.CORRUPTED_LEDGER, key }
  }

  if (raw === null) {
    return { ok: true, empty: true, key }
  }

  try {
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed) || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.coupons)) {
      backupCorrupted(key, raw, '钱包数据结构无效')
      return { ok: false, code: PAYMENT_RESULT.CORRUPTED_LEDGER, key, raw }
    }
    return { ok: true, wallet: parsed, key }
  } catch (error) {
    backupCorrupted(key, raw, '钱包JSON损坏')
    return { ok: false, code: PAYMENT_RESULT.CORRUPTED_LEDGER, key, raw, error }
  }
}

function sanitizeWallet(wallet) {
  const seenTransactionIds = new Set()
  const transactions = []
  let skippedTransactions = 0

  wallet.transactions.forEach(tx => {
    if (isValidTransaction(tx) && !seenTransactionIds.has(tx.id)) {
      seenTransactionIds.add(tx.id)
      transactions.push({ ...tx, extra: tx.extra || {} })
    } else {
      skippedTransactions += 1
    }
  })

  const seenCouponIds = new Set()
  const coupons = []
  let skippedCoupons = 0
  wallet.coupons.forEach(coupon => {
    if (isValidCoupon(coupon) && !seenCouponIds.has(coupon.id)) {
      seenCouponIds.add(coupon.id)
      coupons.push({ ...coupon })
    } else {
      skippedCoupons += 1
    }
  })

  return {
    wallet: {
      version: 1,
      userId: wallet.userId,
      createdAt: wallet.createdAt || nowText(),
      updatedAt: wallet.updatedAt || nowText(),
      transactions,
      coupons
    },
    skippedTransactions,
    skippedCoupons
  }
}

function saveWallet(userId, wallet) {
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({ ...wallet, userId, updatedAt: nowText() })
    )
    return true
  } catch (error) {
    logger.error('保存钱包失败', error)
    return false
  }
}

function createDefaultWallet(userId) {
  const createdAt = new Date()
  const transactions = [
    {
      id: createId('W'),
      type: 'recharge',
      title: '会员储值',
      amount: 588,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -45)),
      extra: { source: 'member' }
    },
    {
      id: createId('W'),
      type: 'expense',
      title: '3号球桌场地费',
      amount: 120,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -12)),
      extra: { typeName: '球桌预约' }
    },
    {
      id: createId('W'),
      type: 'expense',
      title: '专业台球手套',
      amount: 100,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -6)),
      extra: { typeName: '商城订单' }
    },
    {
      id: createId('W'),
      type: 'points_earn',
      title: '新会员礼遇积分',
      amount: 2630,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -45)),
      extra: { source: 'member' }
    },
    {
      id: createId('W'),
      type: 'points_earn',
      title: '预约消费奖励',
      amount: 50,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -12))
    },
    {
      id: createId('W'),
      type: 'points_earn',
      title: '课程报名奖励',
      amount: 100,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -8))
    },
    {
      id: createId('W'),
      type: 'points_spend',
      title: '兑换10元优惠券',
      amount: 200,
      status: 'posted',
      date: formatDateTime(addDays(createdAt, -5))
    }
  ]

  const coupons = [
    {
      id: createId('CP'),
      name: '10元优惠券',
      discount: 10,
      minSpend: 100,
      grantedAt: dateText(addDays(createdAt, -5)),
      expireAt: dateText(addDays(createdAt, 85)),
      status: 'active'
    },
    {
      id: createId('CP'),
      name: '20元优惠券',
      discount: 20,
      minSpend: 300,
      grantedAt: dateText(addDays(createdAt, -3)),
      expireAt: dateText(addDays(createdAt, 87)),
      status: 'active'
    },
    {
      id: createId('CP'),
      name: '1小时免费打球券',
      discount: 60,
      minSpend: 0,
      grantedAt: dateText(addDays(createdAt, -1)),
      expireAt: dateText(addDays(createdAt, 59)),
      status: 'active'
    }
  ]

  coupons.forEach(coupon => {
    transactions.push({
      id: createId('W'),
      type: 'coupon_grant',
      title: coupon.name,
      amount: coupon.discount,
      status: 'posted',
      date: `${coupon.grantedAt} 09:00`,
      couponId: coupon.id
    })
  })

  return {
    version: 1,
    userId,
    createdAt: formatDateTime(createdAt),
    updatedAt: formatDateTime(createdAt),
    transactions: sortTransactions(transactions),
    coupons
  }
}

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => {
    const timeDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
    if (timeDiff !== 0) return timeDiff
    return String(b.id).localeCompare(String(a.id))
  })
}

function summarize(wallet) {
  let balance = 0
  let points = 0
  wallet.transactions.forEach(tx => {
    if (tx.status !== 'posted') return
    const config = transactionTypeConfig[tx.type]
    if (!config) return
    if (config.category === 'balance' || config.category === 'consumption') {
      balance += tx.amount * config.sign
    }
    if (config.category === 'points') {
      points += tx.amount * config.sign
    }
  })

  const today = new Date(new Date().toDateString()).getTime()
  const availableCoupons = wallet.coupons.filter(coupon => {
    if (coupon.status !== 'active') return false
    return new Date(coupon.expireAt).getTime() >= today
  })
  const couponValue = availableCoupons.reduce((sum, coupon) => sum + coupon.discount, 0)

  return {
    balance: roundMoney(balance),
    points,
    couponCount: availableCoupons.length,
    couponValue,
    processingCount: wallet.transactions.filter(tx => tx.status === 'processing').length
  }
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function decorateTransaction(tx) {
  const config = transactionTypeConfig[tx.type]
  return {
    ...tx,
    typeName: config?.label || tx.type,
    category: config?.category || 'other',
    signedAmount: tx.amount * (config?.sign || 0)
  }
}

function enrichWallet(wallet) {
  const summary = summarize(wallet)
  return {
    ...wallet,
    summary,
    transactions: sortTransactions(wallet.transactions).map(decorateTransaction),
    coupons: [...wallet.coupons].sort((a, b) => new Date(a.expireAt) - new Date(b.expireAt))
  }
}

export function initializeForCurrentUser() {
  if (!authState.isLoggedIn || !authState.user?.id) {
    return { ok: false, code: PAYMENT_RESULT.NOT_AUTHENTICATED }
  }
  const userId = authState.user.id
  const readResult = readStoredWallet(userId)

  if (!readResult.ok) {
    const wallet = createDefaultWallet(userId)
    if (!saveWallet(userId, wallet)) return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED }
    syncUserAssets(summarize(wallet))
    return { ok: true, wallet: enrichWallet(wallet), repaired: true }
  }

  if (readResult.empty) {
    const wallet = createDefaultWallet(userId)
    if (!saveWallet(userId, wallet)) return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED }
    syncUserAssets(summarize(wallet))
    return { ok: true, wallet: enrichWallet(wallet), initialized: true }
  }

  const { wallet: sanitized, skippedTransactions, skippedCoupons } = sanitizeWallet(readResult.wallet)
  const repaired = skippedTransactions > 0 || skippedCoupons > 0
  if (sanitized.userId !== userId) {
    const wallet = createDefaultWallet(userId)
    if (!saveWallet(userId, wallet)) return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED }
    syncUserAssets(summarize(wallet))
    return { ok: true, wallet: enrichWallet(wallet), repaired: true }
  }

  if (repaired && !saveWallet(userId, sanitized)) {
    return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, wallet: enrichWallet(sanitized) }
  }

  syncUserAssets(summarize(sanitized))
  return {
    ok: true,
    wallet: enrichWallet(sanitized),
    repaired,
    skippedTransactions,
    skippedCoupons
  }
}

export function getWalletSnapshot() {
  const initResult = initializeForCurrentUser()
  if (!initResult.ok) return null
  return initResult.wallet
}

export function getTransactions(filter = 'all') {
  const wallet = getWalletSnapshot()
  if (!wallet) return []
  if (filter === 'all') return wallet.transactions
  if (filter === 'consumption') {
    return wallet.transactions.filter(tx => ['expense', 'refund'].includes(tx.type))
  }
  return wallet.transactions.filter(tx => tx.category === filter)
}

export function getAvailableCoupons() {
  const wallet = getWalletSnapshot()
  if (!wallet) return []
  const today = new Date(new Date().toDateString()).getTime()
  return wallet.coupons.filter(coupon => coupon.status === 'active' && new Date(coupon.expireAt).getTime() >= today)
}

export async function recoverTaskPayments(options = {}) {
  const initResult = initializeForCurrentUser()
  if (!initResult.ok) return { ok: false, code: initResult.code, recovered: 0 }

  const wallet = initResult.wallet
  const rawTransactions = sanitizeWallet(wallet).wallet.transactions
  let changed = false
  let recovered = 0
  let heldAmount = 0

  for (const tx of rawTransactions.filter(item => item.status === 'processing' && item.type === 'expense')) {
    heldAmount += tx.amount
    let confirmed = !tx.taskId

    if (!confirmed && typeof options.getTask === 'function') {
      const task = await options.getTask(tx)
      if (!task) {
        confirmed = false
      } else if (task.status !== 'pending_payment') {
        confirmed = true
      } else if (typeof options.markPaid === 'function') {
        const updatedTask = await options.markPaid(tx)
        confirmed = !!updatedTask
      }
    }

    if (confirmed) {
      tx.status = 'posted'
      changed = true
      recovered += 1
    }
  }

  if (changed) {
    const nextWallet = { ...wallet, transactions: rawTransactions }
    if (!saveWallet(authState.user.id, nextWallet)) {
      return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, recovered: 0, heldAmount }
    }
    syncUserAssets(summarize(nextWallet))
    return { ok: true, recovered, heldAmount, wallet: enrichWallet(nextWallet) }
  }

  return { ok: true, recovered, heldAmount, wallet }
}

function nextWalletFromRaw(currentWallet, rawTransactions, coupons = null) {
  return {
    version: 1,
    userId: authState.user.id,
    createdAt: currentWallet.createdAt,
    updatedAt: nowText(),
    transactions: sortTransactions(rawTransactions),
    coupons: coupons || currentWallet.coupons
  }
}

export async function payForTask(task, options = {}) {
  if (!authState.isLoggedIn || !authState.user?.id) {
    return { ok: false, code: PAYMENT_RESULT.NOT_AUTHENTICATED }
  }

  const idempotencyKey = typeof options.idempotencyKey === 'string' ? options.idempotencyKey.trim() : ''
  if (!idempotencyKey) return { ok: false, code: PAYMENT_RESULT.INVALID_REQUEST, message: '缺少提交凭证' }
  if (!isPlainObject(task) || typeof task.id !== 'string' || !task.id.trim()) {
    return { ok: false, code: PAYMENT_RESULT.INVALID_TASK, message: '任务信息无效' }
  }
  if (!isPositiveNumber(task.amount)) {
    return { ok: false, code: PAYMENT_RESULT.INVALID_TASK, message: '支付金额无效' }
  }
  if (typeof task.title !== 'string' || !task.title.trim()) {
    return { ok: false, code: PAYMENT_RESULT.INVALID_TASK, message: '任务名称无效' }
  }
  if (typeof options.commit !== 'function') {
    return { ok: false, code: PAYMENT_RESULT.INVALID_REQUEST, message: '缺少任务状态提交方法' }
  }

  if (activeTaskPayments.has(task.id)) {
    return { ok: false, code: PAYMENT_RESULT.DUPLICATE_SUBMISSION, message: '支付正在处理，请勿重复提交' }
  }
  activeTaskPayments.set(task.id, idempotencyKey)

  try {
    const initResult = initializeForCurrentUser()
    if (!initResult.ok) {
      return { ok: false, code: initResult.code, message: '钱包暂不可用' }
    }

    const currentWallet = initResult.wallet
    const { wallet: cleanWallet, skippedTransactions, skippedCoupons } = sanitizeWallet(currentWallet)
    if (skippedTransactions || skippedCoupons) {
      return { ok: false, code: PAYMENT_RESULT.CORRUPTED_LEDGER, message: '钱包明细存在异常，请先修复后再支付' }
    }

    const existingPosted = cleanWallet.transactions.find(
      tx => tx.type === 'expense' && tx.taskId === task.id && tx.status === 'posted'
    )
    if (existingPosted) {
      const committed = await safeCommit(options.commit, existingPosted)
      if (committed) {
        return { ok: true, code: PAYMENT_RESULT.ALREADY_PAID, alreadyPaid: true, transaction: decorateTransaction(existingPosted) }
      }
      return { ok: false, code: PAYMENT_RESULT.COMMIT_FAILED, message: '任务状态修复失败' }
    }

    const processing = cleanWallet.transactions.find(
      tx => tx.type === 'expense' && tx.taskId === task.id && tx.status === 'processing'
    )
    if (processing) {
      const committed = await safeCommit(options.commit, processing)
      if (!committed) {
        return { ok: false, code: PAYMENT_RESULT.COMMIT_FAILED, message: '支付结果恢复中，请稍后重试' }
      }
      processing.status = 'posted'
      processing.idempotencyKey = processing.idempotencyKey || idempotencyKey
      const recoveredWallet = nextWalletFromRaw(cleanWallet, cleanWallet.transactions)
      if (!saveWallet(authState.user.id, recoveredWallet)) {
        return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, message: '支付结果保存失败' }
      }
      syncUserAssets(summarize(recoveredWallet))
      return { ok: true, code: PAYMENT_RESULT.RECOVERED, transaction: decorateTransaction(processing) }
    }

    const currentSummary = summarize(cleanWallet)
    if (currentSummary.balance < task.amount) {
      return {
        ok: false,
        code: PAYMENT_RESULT.INSUFFICIENT_BALANCE,
        message: '钱包余额不足，请充值后再试',
        balance: currentSummary.balance
      }
    }

    const paymentTx = {
      id: createId('PAY'),
      type: 'expense',
      title: task.title,
      amount: task.amount,
      status: 'processing',
      date: nowText(),
      taskId: task.id,
      idempotencyKey,
      extra: {
        type: task.type,
        typeName: task.typeName,
        subtitle: task.subtitle
      }
    }

    const pendingTransactions = [paymentTx, ...cleanWallet.transactions]
    const pendingWallet = nextWalletFromRaw(cleanWallet, pendingTransactions)
    if (!saveWallet(authState.user.id, pendingWallet)) {
      return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, message: '支付明细保存失败' }
    }

    const committed = await safeCommit(options.commit, paymentTx)
    if (!committed) {
      return { ok: false, code: PAYMENT_RESULT.COMMIT_FAILED, message: '任务状态更新失败，款项已暂时锁定' }
    }

    paymentTx.status = 'posted'
    const postedWallet = nextWalletFromRaw(cleanWallet, [paymentTx, ...cleanWallet.transactions])
    if (!saveWallet(authState.user.id, postedWallet)) {
      return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, message: '支付结果保存失败，款项已暂时锁定' }
    }

    syncUserAssets(summarize(postedWallet))
    return { ok: true, code: PAYMENT_RESULT.OK, transaction: decorateTransaction(paymentTx) }
  } finally {
    activeTaskPayments.delete(task.id)
  }
}

async function safeCommit(commit, transaction) {
  try {
    const result = await commit(transaction)
    return result !== false && result !== null
  } catch (error) {
    logger.error('钱包支付后任务状态提交失败', error)
    return false
  }
}

export async function exchangePointsForGift(giftId, idempotencyKey) {
  if (!authState.isLoggedIn || !authState.user?.id) {
    return { ok: false, code: PAYMENT_RESULT.NOT_AUTHENTICATED }
  }
  const gift = couponGifts.find(item => item.id === giftId)
  if (!gift || gift.kind !== 'coupon') {
    return { ok: false, code: PAYMENT_RESULT.INVALID_REQUEST, message: '礼品不存在' }
  }
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    return { ok: false, code: PAYMENT_RESULT.INVALID_REQUEST, message: '缺少兑换凭证' }
  }
  const key = idempotencyKey.trim()
  if (activeExchanges.has(key)) {
    return { ok: false, code: PAYMENT_RESULT.DUPLICATE_SUBMISSION, message: '兑换正在处理，请勿重复提交' }
  }
  activeExchanges.add(key)

  try {
    const initResult = initializeForCurrentUser()
    if (!initResult.ok) return { ok: false, code: initResult.code }
    const { wallet: cleanWallet, skippedTransactions, skippedCoupons } = sanitizeWallet(initResult.wallet)
    if (skippedTransactions || skippedCoupons) {
      return { ok: false, code: PAYMENT_RESULT.CORRUPTED_LEDGER, message: '钱包明细存在异常，请先修复' }
    }
    if (cleanWallet.transactions.some(tx => tx.status === 'posted' && tx.idempotencyKey === key)) {
      return { ok: true, code: PAYMENT_RESULT.ALREADY_PAID, alreadyProcessed: true }
    }

    const summary = summarize(cleanWallet)
    if (summary.points < gift.points) {
      return { ok: false, code: PAYMENT_RESULT.INSUFFICIENT_POINTS, message: '积分余额不足', points: summary.points }
    }

    const grantedAt = new Date()
    const coupon = {
      id: createId('CP'),
      name: gift.coupon.name,
      discount: gift.coupon.discount,
      minSpend: gift.coupon.minSpend,
      grantedAt: dateText(grantedAt),
      expireAt: dateText(addDays(grantedAt, gift.coupon.validDays)),
      status: 'active'
    }
    const spendTx = {
      id: createId('PTS'),
      type: 'points_spend',
      title: `兑换${gift.coupon.name}`,
      amount: gift.points,
      status: 'posted',
      date: nowText(),
      idempotencyKey: key
    }
    const grantTx = {
      id: createId('CPN'),
      type: 'coupon_grant',
      title: gift.coupon.name,
      amount: gift.coupon.discount,
      status: 'posted',
      date: nowText(),
      couponId: coupon.id,
      idempotencyKey: key
    }

    const nextWallet = nextWalletFromRaw(
      cleanWallet,
      [spendTx, grantTx, ...cleanWallet.transactions],
      [coupon, ...cleanWallet.coupons]
    )
    if (!saveWallet(authState.user.id, nextWallet)) {
      return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED, message: '兑换结果保存失败' }
    }
    syncUserAssets(summarize(nextWallet))
    return { ok: true, code: PAYMENT_RESULT.OK, coupon, transaction: decorateTransaction(spendTx) }
  } finally {
    activeExchanges.delete(key)
  }
}

export function repairCurrentWallet() {
  if (!authState.isLoggedIn || !authState.user?.id) {
    return { ok: false, code: PAYMENT_RESULT.NOT_AUTHENTICATED }
  }
  const userId = authState.user.id
  const readResult = readStoredWallet(userId)
  const wallet = readResult.ok && readResult.wallet ? sanitizeWallet(readResult.wallet).wallet : createDefaultWallet(userId)
  if (!saveWallet(userId, wallet)) return { ok: false, code: PAYMENT_RESULT.SAVE_FAILED }
  syncUserAssets(summarize(wallet))
  return { ok: true, wallet: enrichWallet(wallet) }
}

export function clearCurrentWallet() {
  if (!authState.user?.id) return
  try {
    localStorage.removeItem(storageKey(authState.user.id))
  } catch (error) {
    logger.warn('清除钱包缓存失败', error)
  }
}

export const walletStore = {
  initialize: initializeForCurrentUser,
  getSnapshot: getWalletSnapshot,
  getTransactions,
  getAvailableCoupons,
  payForTask,
  exchangePointsForGift,
  recoverTaskPayments,
  repairCurrentWallet,
  clearCurrentWallet,
  couponGifts
}

export default walletStore
