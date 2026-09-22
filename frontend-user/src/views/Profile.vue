<template>
  <div class="profile-page">
    <div class="profile-layout">
      <aside class="profile-sidebar">
        <div class="user-card">
          <div class="user-avatar"><span>{{ user.name.charAt(0) }}</span><div class="avatar-ring"></div></div>
          <h2>{{ user.name }}</h2>
          <div class="user-level"><span class="level-badge">{{ user.level }}</span><span class="level-text">会员</span></div>
          <div class="user-id">ID: {{ user.id }}</div>
          <button class="btn-edit-profile" @click="showEditModal = true">编辑资料</button>
        </div>

        <div class="wallet-mini-card" @click="scrollToWallet">
          <div class="wallet-mini-header">
            <span class="wallet-mini-label">💰 钱包余额</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </div>
          <div class="wallet-mini-value">¥{{ formatMoney(walletState.balance) }}</div>
          <div class="wallet-mini-sub">点击查看资产概览</div>
        </div>

        <div class="points-card">
          <div class="points-header"><span class="points-label">可用积分</span><button class="points-history" @click="openRecordsModal('points')">明细</button></div>
          <div class="points-value">{{ currentPoints.toLocaleString() }}</div>
          <button class="btn-points" @click="showExchangeModal = true">积分兑换</button>
        </div>

        <nav class="profile-nav">
          <a href="#" class="nav-item" :class="{ active: activeNav === 'info' }" @click.prevent="handleNavClick('info')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>个人信息</span>
          </a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'bookings' }" @click.prevent="handleNavClick('bookings')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            <span>我的预约</span>
          </a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'wallet' }" @click.prevent="handleNavClick('wallet')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01M2 10h20"/></svg>
            <span>会员钱包</span>
          </a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'tasks' }" @click.prevent="handleNavClick('tasks')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <span>任务中心</span>
          </a>
          <a href="#" class="nav-item" @click.prevent="showLogoutModal = true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>退出登录</span>
          </a>
        </nav>
      </aside>

      <main class="profile-main">
        <!-- 会员钱包与资产概览 -->
        <section ref="walletSection" class="wallet-section">
          <div class="section-header">
            <h3>会员钱包</h3>
            <span v-if="walletState.ledgerCorrupted || walletState.balanceCorrupted" class="data-warn">
              ⚠️ 检测到部分历史数据损坏已隔离，当前余额不受影响
            </span>
          </div>

          <div class="wallet-hero">
            <div class="wallet-hero-bg"></div>
            <div class="wallet-hero-content">
              <div class="wallet-hero-label">账户余额（元）</div>
              <div class="wallet-hero-balance">¥{{ formatMoney(walletState.balance) }}</div>
              <div class="wallet-hero-actions">
                <button class="btn-recharge" :disabled="actionLoading" @click="openRecharge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                  充值
                </button>
                <button class="btn-wallet-detail" @click="openRecordsModal('all')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                  消费明细
                </button>
              </div>
            </div>
          </div>

          <div class="assets-grid">
            <div class="asset-card points" @click="openRecordsModal('points')">
              <div class="asset-top"><span class="asset-icon">⭐</span><span class="asset-link">明细 ›</span></div>
              <div class="asset-value">{{ currentPoints.toLocaleString() }}</div>
              <div class="asset-label">可用积分</div>
            </div>
            <div class="asset-card coupon" @click="showCouponModal = true">
              <div class="asset-top"><span class="asset-icon">🎫</span><span class="asset-link">查看 ›</span></div>
              <div class="asset-value">{{ usableCouponCount }} <span class="asset-unit">张</span></div>
              <div class="asset-label">可用优惠券</div>
            </div>
            <div class="asset-card consumed">
              <div class="asset-top"><span class="asset-icon">📊</span></div>
              <div class="asset-value">¥{{ formatMoney(totalConsumed) }}</div>
              <div class="asset-label">累计消费</div>
            </div>
          </div>

          <!-- 消费明细（按类型筛选） -->
          <div class="ledger-card">
            <div class="ledger-header">
              <h4>消费明细</h4>
              <button class="btn-view-all" @click="openRecordsModal('all')">查看全部</button>
            </div>
            <div class="ledger-filters">
              <button
                v-for="tab in recordTabs"
                :key="tab.key"
                class="ledger-tab"
                :class="{ active: activeRecordType === tab.key }"
                @click="activeRecordType = tab.key"
              >{{ tab.name }}</button>
            </div>

            <div v-if="visibleRecords.length" class="ledger-list">
              <div v-for="record in visibleRecords" :key="record.id" class="ledger-item">
                <div class="ledger-icon" :class="record.asset">{{ typeIcon(record.type) }}</div>
                <div class="ledger-info">
                  <span class="ledger-title">
                    {{ record.title }}
                    <em v-if="record.status === 'reversed'" class="reversed-tag">已冲正</em>
                  </span>
                  <span class="ledger-date">{{ record.createdAt }}</span>
                </div>
                <div class="ledger-right">
                  <span class="ledger-amount" :class="[record.asset, record.direction]">
                    {{ record.direction === 'in' ? '+' : '-' }}{{ record.asset === 'money' ? '¥' : '' }}{{ formatMoney(record.amount) }}{{ record.asset === 'points' ? ' 分' : '' }}
                  </span>
                  <span v-if="record.asset === 'money' && record.balanceAfter != null" class="ledger-balance">
                    余额 ¥{{ formatMoney(record.balanceAfter) }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="ledger-empty">
              <span class="empty-icon-small">📭</span>
              <p>暂无{{ activeRecordTypeName }}记录</p>
            </div>
          </div>
        </section>

        <section class="stats-section">
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">⏱️</div><div class="stat-content"><span class="stat-value">{{ user.totalHours }}</span><span class="stat-label">累计打球(小时)</span></div></div>
            <div class="stat-card"><div class="stat-icon">🏆</div><div class="stat-content"><span class="stat-value">{{ user.competitions }}</span><span class="stat-label">参赛次数</span></div></div>
            <div class="stat-card"><div class="stat-icon">🥇</div><div class="stat-content"><span class="stat-value">{{ user.wins }}</span><span class="stat-label">获胜场次</span></div></div>
            <div class="stat-card"><div class="stat-icon">📚</div><div class="stat-content"><span class="stat-value">{{ user.courses }}</span><span class="stat-label">已学课程</span></div></div>
          </div>
        </section>

        <section class="bookings-section">
          <div class="section-header"><h3>最近预约</h3><button class="btn-view-all" @click="viewAllBookings">查看全部</button></div>
          <div class="bookings-list">
            <div v-for="booking in recentBookings" :key="booking.id" class="booking-card" @click="viewBookingDetail(booking)">
              <div class="booking-date"><span class="day">{{ getDay(booking.date) }}</span><span class="month">{{ getMonth(booking.date) }}</span></div>
              <div class="booking-info"><h4>{{ booking.tableName }}</h4><p class="booking-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>{{ booking.time }}</p></div>
              <div class="booking-status" :class="booking.status">{{ statusText[booking.status] }}</div>
            </div>
          </div>
        </section>

        <section class="actions-section">
          <div class="section-header"><h3>快捷服务</h3></div>
          <div class="actions-grid">
            <div v-for="action in quickActions" :key="action.id" class="action-card" @click="handleAction(action)">
              <div class="action-icon">{{ action.icon }}</div>
              <span class="action-name">{{ action.name }}</span>
              <svg class="action-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- Edit Profile Modal -->
    <Modal v-model="showEditModal" title="编辑资料" size="small" confirm-text="保存" :loading="saveLoading" @confirm="saveProfile">
      <div class="edit-form">
        <div class="form-group"><label>昵称</label><input v-model="editForm.name" type="text" placeholder="请输入昵称" /></div>
        <div class="form-group"><label>手机号</label><input v-model="editForm.phone" type="tel" placeholder="请输入手机号" /></div>
        <div class="form-group"><label>邮箱</label><input v-model="editForm.email" type="email" placeholder="请输入邮箱" /></div>
      </div>
    </Modal>

    <!-- 充值 Modal -->
    <Modal v-model="showRechargeModal" icon="💰" icon-type="info" title="钱包充值" subtitle="选择或输入充值金额（模拟支付）" size="small" confirm-text="确认充值" :loading="rechargeLoading" @confirm="confirmRecharge">
      <div class="recharge-form">
        <div class="recharge-amount">¥{{ formatMoney(rechargeAmount) }}</div>
        <div class="recharge-options">
          <button
            v-for="opt in rechargeOptions"
            :key="opt"
            type="button"
            class="recharge-chip"
            :class="{ active: Number(rechargeAmount) === opt }"
            @click="rechargeAmount = opt"
          >¥{{ opt.toLocaleString() }}</button>
        </div>
        <div class="form-group">
          <label>自定义金额</label>
          <input v-model.number="rechargeInput" type="number" min="1" max="50000" placeholder="输入 1 ~ 50000" @input="onRechargeInput" />
        </div>
        <div class="recharge-balance-line">当前余额：¥{{ formatMoney(walletState.balance) }}</div>
      </div>
    </Modal>

    <!-- 优惠券 Modal -->
    <Modal v-model="showCouponModal" title="我的优惠券" size="medium" :show-footer="false">
      <div class="coupon-list">
        <div v-for="coupon in walletState.coupons" :key="coupon.id" class="coupon-card" :class="{ used: coupon.used }">
          <div class="coupon-amount">
            <span class="cny">¥</span><span class="num">{{ coupon.amount }}</span>
          </div>
          <div class="coupon-divider"></div>
          <div class="coupon-info">
            <h4>{{ coupon.name }}</h4>
            <p>{{ coupon.minSpend > 0 ? `满 ¥${coupon.minSpend} 可用` : '无消费门槛' }}</p>
            <span class="coupon-expire">有效期至 {{ coupon.expireDate }} · {{ coupon.source }}</span>
          </div>
          <span v-if="coupon.used" class="coupon-used-tag">已使用</span>
        </div>
        <div v-if="!walletState.coupons.length" class="ledger-empty"><span class="empty-icon-small">🎫</span><p>暂无可用优惠券，积分可兑换</p></div>
      </div>
    </Modal>

    <!-- 明细 Modal（按类型） -->
    <Modal v-model="showRecordsModal" :title="recordsModalTitle" size="large" :show-footer="false">
      <div class="ledger-filters modal">
        <button
          v-for="tab in recordTabs"
          :key="tab.key"
          class="ledger-tab"
          :class="{ active: modalRecordType === tab.key }"
          @click="modalRecordType = tab.key"
        >{{ tab.name }}</button>
      </div>
      <div class="points-list records-modal-list">
        <div v-for="record in modalRecords" :key="record.id" class="points-record ledger-modal-record">
          <div class="record-info">
            <span class="record-title">{{ typeIcon(record.type) }} {{ record.title }}
              <em v-if="record.status === 'reversed'" class="reversed-tag">已冲正</em>
            </span>
            <span class="record-date">{{ record.createdAt }}<template v-if="record.orderNo"> · 单号 {{ record.orderNo }}</template></span>
          </div>
          <div class="record-right">
            <span class="record-amount" :class="record.direction === 'in' ? 'add' : 'minus'">
              {{ record.direction === 'in' ? '+' : '-' }}{{ record.asset === 'money' ? '¥' : '' }}{{ formatMoney(record.amount) }}{{ record.asset === 'points' ? ' 分' : '' }}
            </span>
            <span v-if="record.asset === 'money' && record.balanceAfter != null" class="record-sub">余额 ¥{{ formatMoney(record.balanceAfter) }}</span>
          </div>
        </div>
        <div v-if="!modalRecords.length" class="ledger-empty"><span class="empty-icon-small">📭</span><p>暂无{{ modalRecordTypeName }}记录</p></div>
      </div>
    </Modal>

    <!-- Exchange Modal -->
    <Modal v-model="showExchangeModal" icon="🎁" icon-type="info" title="积分兑换" subtitle="选择您想兑换的礼品" size="medium" :show-footer="false">
      <div class="exchange-list">
        <div v-for="gift in gifts" :key="gift.id" class="gift-card">
          <div class="gift-icon">{{ gift.icon }}</div>
          <div class="gift-info"><h4>{{ gift.name }}</h4><span class="gift-points">{{ gift.points }} 积分</span></div>
          <button class="btn-exchange" :disabled="actionLoading || currentPoints < gift.points" @click="exchangeGift(gift)">兑换</button>
        </div>
      </div>
    </Modal>

    <!-- Booking Detail Modal -->
    <Modal v-model="showBookingDetailModal" title="预约详情" size="small" :show-cancel="false" :confirm-text="selectedBooking?.status === 'upcoming' ? '取消预约' : '关闭'" :confirm-type="selectedBooking?.status === 'upcoming' ? 'danger' : 'primary'" @confirm="handleBookingAction">
      <div v-if="selectedBooking" class="booking-detail">
        <div class="detail-row"><span class="label">预约编号</span><span class="value">{{ selectedBooking.orderNo }}</span></div>
        <div class="detail-row"><span class="label">球桌</span><span class="value">{{ selectedBooking.tableName }}</span></div>
        <div class="detail-row"><span class="label">日期</span><span class="value">{{ selectedBooking.date }}</span></div>
        <div class="detail-row"><span class="label">时段</span><span class="value">{{ selectedBooking.time }}</span></div>
        <div class="detail-row"><span class="label">状态</span><span class="value status" :class="selectedBooking.status">{{ statusText[selectedBooking.status] }}</span></div>
      </div>
    </Modal>

    <!-- Logout Modal -->
    <Modal v-model="showLogoutModal" icon="warning" icon-type="warning" title="确认退出" subtitle="您确定要退出登录吗？" size="small" confirm-text="确认退出" confirm-type="danger" @confirm="handleLogout" />

    <!-- Success Modal -->
    <Modal v-model="showSuccessModal" icon="🎉" icon-type="success" :title="successTitle" :subtitle="successMessage" size="small" :show-cancel="false" confirm-text="我知道了" @confirm="showSuccessModal = false" />

    <!-- 登录失效提示 Modal -->
    <Modal v-model="showAuthExpiredModal" icon="warning" icon-type="warning" title="登录已失效" subtitle="您的登录状态已过期，请重新登录后再进行该操作" size="small" :show-cancel="false" confirm-text="重新登录" @confirm="goLogin" />

    <Toast v-model="showToast" :type="toastType" :title="toastTitle" :message="toastMessage" />
  </div>
</template>

<script>
import Modal from '../components/Modal.vue'
import Toast from '../components/Toast.vue'
import { authState, logout, isAuthenticated } from '../utils/auth'
import { logger } from '../utils/api'
import { walletState, walletStore } from '../utils/walletStore'

const RECORD_TABS = [
  { key: 'all', name: '全部' },
  { key: 'money', name: '余额明细' },
  { key: 'points', name: '积分' },
  { key: 'coupon', name: '优惠券' }
]

export default {
  name: 'Profile',
  components: { Modal, Toast },
  data() {
    return {
      activeNav: 'info',
      showEditModal: false,
      showRechargeModal: false,
      showCouponModal: false,
      showRecordsModal: false,
      showExchangeModal: false,
      showBookingDetailModal: false,
      showLogoutModal: false,
      showSuccessModal: false,
      showAuthExpiredModal: false,
      saveLoading: false,
      rechargeLoading: false,
      actionLoading: false,
      selectedBooking: null,
      successTitle: '',
      successMessage: '',
      showToast: false,
      toastType: 'success',
      toastTitle: '',
      toastMessage: '',
      editForm: { name: '', phone: '', email: '' },
      activeRecordType: 'all',
      modalRecordType: 'all',
      recordTabs: RECORD_TABS,
      rechargeAmount: 500,
      rechargeInput: '',
      rechargeOptions: [100, 500, 1000, 2000],
      statusText: { completed: '已完成', upcoming: '待使用', cancelled: '已取消' },
      recentBookings: [
        { id: 1, orderNo: 'BK20260001', tableName: '3号球桌 - 美式九球', date: '2026-02-15', time: '14:00 - 16:00', status: 'upcoming' },
        { id: 2, orderNo: 'BK20260002', tableName: '1号球桌 - 斯诺克', date: '2026-02-10', time: '19:00 - 21:00', status: 'completed' },
        { id: 3, orderNo: 'BK20260003', tableName: '5号球桌 - 中式八球', date: '2026-02-08', time: '10:00 - 12:00', status: 'completed' }
      ],
      quickActions: [
        { id: 1, name: '任务中心', icon: '📋', action: 'tasks' },
        { id: 2, name: '优惠券', icon: '🎫', action: 'coupon' },
        { id: 3, name: '邀请好友', icon: '👥', action: 'invite' },
        { id: 4, name: '意见反馈', icon: '💬', action: 'feedback' },
        { id: 5, name: '帮助中心', icon: '❓', action: 'help' }
      ],
      gifts: [
        { id: 1, name: '10元无门槛优惠券', icon: '🎫', points: 200, coupon: { name: '10元无门槛券', amount: 10, minSpend: 0 } },
        { id: 2, name: '满1000减100优惠券', icon: '🎟️', points: 500, coupon: { name: '满1000减100券', amount: 100, minSpend: 1000 } },
        { id: 3, name: '1小时免费打球', icon: '🎱', points: 500 },
        { id: 4, name: '专业巧克粉', icon: '🧊', points: 300 },
        { id: 5, name: '台球手套', icon: '🧤', points: 800 }
      ]
    }
  },
  computed: {
    walletState() {
      return walletState
    },
    user() {
      return authState.user || { id: '', name: '游客', level: '普通', points: 0, totalHours: 0, competitions: 0, wins: 0, courses: 0 }
    },
    currentPoints() {
      return Number(authState.user?.points || 0)
    },
    visibleRecords() {
      // 页面内只预览最近 5 条，完整列表在明细弹窗
      return walletStore.getRecords(this.activeRecordType).slice(0, 5)
    },
    modalRecords() {
      return walletStore.getRecords(this.modalRecordType)
    },
    usableCouponCount() {
      return walletStore.getUsableCoupons().length
    },
    totalConsumed() {
      return walletState.ledger
        .filter((r) => r.type === 'consume' && r.status !== 'reversed')
        .reduce((sum, r) => Math.round((sum + r.amount) * 100) / 100, 0)
    },
    activeRecordTypeName() {
      return RECORD_TABS.find((t) => t.key === this.activeRecordType)?.name || ''
    },
    modalRecordTypeName() {
      return RECORD_TABS.find((t) => t.key === this.modalRecordType)?.name || ''
    },
    recordsModalTitle() {
      if (this.modalRecordType === 'all') return '全部明细'
      if (this.modalRecordType === 'money') return '余额明细'
      if (this.modalRecordType === 'points') return '积分明细'
      if (this.modalRecordType === 'coupon') return '优惠券记录'
      return '明细'
    }
  },
  mounted() {
    this.editForm = {
      name: this.user.name,
      phone: this.user.phone || '',
      email: this.user.email || ''
    }

    // 主动退出登录进入本页时不再提示登录失效
    if (!isAuthenticated() && !this.$route.query.loggedOut) {
      // 登录失效（如 token 被清理）：资产与任务数据保持原状，仅提示重新登录
      this.showAuthExpiredModal = true
      return
    }
    if (!isAuthenticated()) return

    // 返回个人中心：先对账，确保钱包金额与任务状态一致
    const result = walletStore.reconcile()
    if (result.healed.length || result.refunds.length) {
      this.$nextTick(() => {
        const parts = []
        if (result.healed.length) parts.push(`${result.healed.length} 笔任务状态已同步`)
        if (result.refunds.length) parts.push(`${result.refunds.length} 笔款项已自动退回钱包`)
        this.showNotification('info', '账户已核对', parts.join('，'))
      })
    }

    // 从任务中心支付失败跳来的充值入口
    if (this.$route.query.action === 'recharge') {
      this.$nextTick(() => this.openRecharge())
    }
  },
  methods: {
    formatMoney(n) {
      const num = Number(n)
      return (isFinite(num) ? num : 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    typeIcon(type) {
      return {
        recharge: '💰',
        consume: '💳',
        refund: '↩️',
        points_earn: '⭐',
        points_spend: '🎁',
        coupon_grant: '🎫'
      }[type] || '📋'
    },
    getDay(date) { return new Date(date).getDate() },
    getMonth(date) { return ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'][new Date(date).getMonth()] },
    scrollToWallet() {
      this.activeNav = 'wallet'
      this.$el.querySelector('.wallet-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    openRecordsModal(type) {
      this.modalRecordType = type || 'all'
      this.showRecordsModal = true
    },
    openRecharge() {
      if (!isAuthenticated()) {
        this.showAuthExpiredModal = true
        return
      }
      this.rechargeAmount = 500
      this.rechargeInput = ''
      this.showRechargeModal = true
    },
    onRechargeInput() {
      const v = Number(this.rechargeInput)
      if (isFinite(v) && v > 0) this.rechargeAmount = v
    },
    async confirmRecharge() {
      if (this.rechargeLoading) return
      this.rechargeLoading = true
      const result = await walletStore.recharge(Number(this.rechargeAmount))
      this.rechargeLoading = false

      if (result.success) {
        this.showRechargeModal = false
        this.successTitle = '充值成功'
        this.successMessage = `已到账 ¥${this.formatMoney(Number(this.rechargeAmount))}，当前余额 ¥${this.formatMoney(result.balanceAfter)}`
        this.showSuccessModal = true
      } else if (result.code === 'AUTH_EXPIRED') {
        this.showRechargeModal = false
        this.showAuthExpiredModal = true
      } else {
        this.showNotification('error', '充值失败', result.message)
      }
    },
    handleNavClick(nav) {
      this.activeNav = nav
      if (nav === 'info') {
        this.showEditModal = true
      } else if (nav === 'bookings') {
        this.showNotification('info', '我的预约', `您有 ${this.recentBookings.filter(b => b.status === 'upcoming').length} 个待使用的预约`)
      } else if (nav === 'wallet') {
        this.scrollToWallet()
      } else if (nav === 'tasks') {
        this.$router.push('/tasks')
      }
    },
    viewAllBookings() {
      this.showNotification('info', '全部预约', `共 ${this.recentBookings.length} 条预约记录`)
    },
    async saveProfile() {
      // 表单验证
      if (!this.editForm.name || this.editForm.name.trim().length < 2) {
        this.showNotification('error', '验证失败', '昵称至少需要2个字符')
        return
      }
      if (this.editForm.phone && !/^1[3-9]\d{9}$/.test(this.editForm.phone)) {
        this.showNotification('error', '验证失败', '请输入正确的手机号码')
        return
      }
      if (this.editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.editForm.email)) {
        this.showNotification('error', '验证失败', '请输入正确的邮箱地址')
        return
      }
      this.saveLoading = true
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (authState.user) {
        authState.user.name = this.editForm.name
      }
      this.saveLoading = false
      this.showEditModal = false
      this.showNotification('success', '保存成功', '个人资料已更新')
      logger.info('Profile updated', { name: this.editForm.name })
    },
    viewBookingDetail(booking) { this.selectedBooking = booking; this.showBookingDetailModal = true },
    handleBookingAction() {
      if (this.selectedBooking?.status === 'upcoming') {
        this.selectedBooking.status = 'cancelled'
        this.showBookingDetailModal = false
        this.showNotification('success', '取消成功', '预约已取消')
        logger.info('Booking cancelled', { orderNo: this.selectedBooking.orderNo })
      } else { this.showBookingDetailModal = false }
    },
    handleAction(action) {
      if (action.action === 'tasks') {
        this.$router.push('/tasks')
      } else if (action.action === 'coupon') {
        this.showCouponModal = true
      } else {
        this.showNotification('info', action.name, '功能开发中，敬请期待')
      }
    },
    async exchangeGift(gift) {
      if (this.actionLoading) return
      if (this.currentPoints < gift.points) {
        this.showNotification('error', '积分不足', '您的积分不足以兑换该礼品')
        return
      }
      this.actionLoading = true
      const result = await walletStore.exchangePoints(gift)
      this.actionLoading = false

      if (result.success) {
        this.showExchangeModal = false
        this.successTitle = '兑换成功'
        this.successMessage = result.coupon
          ? `您已成功兑换 ${gift.name}，已发放至「我的优惠券」`
          : `您已成功兑换 ${gift.name}`
        this.showSuccessModal = true
        logger.info('Gift exchanged', { gift: gift.name, points: gift.points })
      } else if (result.code === 'AUTH_EXPIRED') {
        this.showExchangeModal = false
        this.showAuthExpiredModal = true
      } else {
        this.showNotification('error', '兑换失败', result.message)
      }
    },
    async handleLogout() {
      this.showLogoutModal = false
      logger.info('User logging out')
      await logout()
      this.$router.push({ path: '/', query: { loggedOut: 1 } })
    },
    goLogin() {
      this.showAuthExpiredModal = false
      // 留在个人中心，直接唤起全局登录弹窗，登录后数据原样可见
      window.dispatchEvent(new CustomEvent('billiard:open-login'))
    },
    showNotification(type, title, message) { this.toastType = type; this.toastTitle = title; this.toastMessage = message; this.showToast = true }
  }
}
</script>

<style scoped>
.profile-page { max-width: 1400px; margin: 0 auto; padding: 2rem 3rem 4rem; }
.profile-layout { display: grid; grid-template-columns: 300px 1fr; gap: 2rem; }
.profile-sidebar { display: flex; flex-direction: column; gap: 1rem; }
.user-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 24px; padding: 2rem; text-align: center; }
.user-avatar { position: relative; width: 100px; height: 100px; margin: 0 auto 1.5rem; }
.user-avatar span { position: absolute; inset: 4px; background: var(--gradient-1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 700; color: var(--bg-dark); }
.avatar-ring { position: absolute; inset: 0; border: 3px solid var(--primary); border-radius: 50%; animation: rotate 10s linear infinite; border-top-color: transparent; border-left-color: transparent; }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.user-card h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
.user-level { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.level-badge { background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: var(--bg-dark); padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; }
.level-text { color: var(--text-secondary); font-size: 0.85rem; }
.user-id { color: var(--text-muted); font-size: 0.8rem; font-family: monospace; margin-bottom: 1rem; }
.btn-edit-profile { background: rgba(0, 217, 165, 0.1); border: 1px solid rgba(0, 217, 165, 0.3); color: var(--primary); padding: 0.6rem 1.5rem; border-radius: 10px; font-size: 0.85rem; cursor: pointer; transition: all 0.3s; }
.btn-edit-profile:hover { background: rgba(0, 217, 165, 0.2); }
.wallet-mini-card { background: linear-gradient(135deg, rgba(0,217,165,0.15) 0%, rgba(0,180,216,0.12) 100%); border: 1px solid rgba(0, 217, 165, 0.25); border-radius: 20px; padding: 1.25rem 1.5rem; cursor: pointer; transition: all 0.3s; }
.wallet-mini-card:hover { border-color: rgba(0, 217, 165, 0.5); transform: translateY(-2px); }
.wallet-mini-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.wallet-mini-header svg { width: 16px; height: 16px; color: var(--primary); }
.wallet-mini-label { color: var(--text-secondary); font-size: 0.85rem; }
.wallet-mini-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.9rem; font-weight: 700; color: var(--primary); line-height: 1.1; }
.wallet-mini-sub { color: var(--text-muted); font-size: 0.72rem; margin-top: 0.25rem; }
.points-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.points-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.points-label { color: var(--text-secondary); font-size: 0.85rem; }
.points-history { background: transparent; border: none; color: var(--primary); font-size: 0.8rem; cursor: pointer; }
.points-value { font-family: 'Space Grotesk', sans-serif; font-size: 2.5rem; font-weight: 700; color: var(--primary); margin-bottom: 1rem; }
.btn-points { width: 100%; background: rgba(0, 217, 165, 0.1); border: 1px solid rgba(0, 217, 165, 0.3); color: var(--primary); padding: 0.75rem; border-radius: 10px; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.3s; }
.btn-points:hover { background: rgba(0, 217, 165, 0.2); }
.profile-nav { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 0.75rem; }
.nav-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; color: var(--text-secondary); text-decoration: none; border-radius: 12px; transition: all 0.3s; }
.nav-item:hover { background: rgba(255, 255, 255, 0.03); color: var(--text-primary); }
.nav-item.active { background: rgba(0, 217, 165, 0.1); color: var(--primary); }
.nav-item svg { width: 20px; height: 20px; }
.profile-main { display: flex; flex-direction: column; gap: 1.5rem; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.section-header h3 { font-size: 1.1rem; font-weight: 600; }
.data-warn { font-size: 0.75rem; color: #ffc107; }
.btn-view-all { background: transparent; border: none; color: var(--primary); font-size: 0.85rem; cursor: pointer; }

/* 钱包区 */
.wallet-section { display: flex; flex-direction: column; gap: 1rem; scroll-margin-top: 110px; }
.wallet-hero { position: relative; border-radius: 24px; overflow: hidden; }
.wallet-hero-bg { position: absolute; inset: 0; background: var(--gradient-1); opacity: 0.95; }
.wallet-hero-bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 85% 20%, rgba(255,255,255,0.25), transparent 45%); }
.wallet-hero-content { position: relative; padding: 2rem; }
.wallet-hero-label { color: rgba(10,10,15,0.7); font-size: 0.85rem; font-weight: 500; }
.wallet-hero-balance { font-family: 'Space Grotesk', sans-serif; font-size: 3rem; font-weight: 700; color: var(--bg-dark); line-height: 1.2; margin: 0.25rem 0 1.25rem; }
.wallet-hero-actions { display: flex; gap: 0.75rem; }
.btn-recharge, .btn-wallet-detail { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.4rem; border-radius: 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-recharge { background: var(--bg-dark); color: #fff; border: none; }
.btn-recharge:hover:not(:disabled) { transform: translateY(-1px); }
.btn-recharge:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-recharge svg { width: 16px; height: 16px; }
.btn-wallet-detail { background: rgba(10,10,15,0.12); color: var(--bg-dark); border: 1px solid rgba(10,10,15,0.25); }
.btn-wallet-detail svg { width: 16px; height: 16px; }

.assets-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
.asset-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 18px; padding: 1.25rem 1.5rem; cursor: pointer; transition: all 0.3s; }
.asset-card:hover { border-color: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.asset-card.consumed { cursor: default; }
.asset-card.consumed:hover { transform: none; border-color: var(--border); }
.asset-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
.asset-icon { font-size: 1.4rem; }
.asset-link { font-size: 0.75rem; color: var(--primary); }
.asset-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); line-height: 1.1; }
.asset-card.points .asset-value { color: #ffc107; }
.asset-card.coupon .asset-value { color: #4facfe; }
.asset-unit { font-size: 0.9rem; font-weight: 500; color: var(--text-secondary); }
.asset-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.3rem; }

/* 明细列表 */
.ledger-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.ledger-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.ledger-header h4 { font-size: 1rem; font-weight: 600; }
.ledger-filters { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.ledger-filters.modal { margin-bottom: 1.25rem; }
.ledger-tab { padding: 0.4rem 1rem; background: rgba(255,255,255,0.03); border: 1px solid var(--border); color: var(--text-secondary); border-radius: 20px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
.ledger-tab:hover { color: var(--text-primary); }
.ledger-tab.active { background: rgba(0, 217, 165, 0.15); border-color: rgba(0, 217, 165, 0.3); color: var(--primary); }
.ledger-list { display: flex; flex-direction: column; gap: 0.5rem; }
.ledger-item { display: flex; align-items: center; gap: 1rem; padding: 0.875rem 1rem; background: rgba(255,255,255,0.02); border-radius: 12px; }
.ledger-icon { width: 38px; height: 38px; flex-shrink: 0; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.05rem; background: rgba(255,255,255,0.05); }
.ledger-icon.money { background: rgba(0, 217, 165, 0.12); }
.ledger-icon.points { background: rgba(255, 193, 7, 0.12); }
.ledger-icon.coupon { background: rgba(79, 172, 254, 0.12); }
.ledger-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.ledger-title { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ledger-date { font-size: 0.72rem; color: var(--text-muted); }
.ledger-right { display: flex; flex-direction: column; align-items: flex-end; }
.ledger-amount { font-family: 'Space Grotesk', sans-serif; font-size: 0.98rem; font-weight: 700; white-space: nowrap; }
.ledger-amount.money.out, .ledger-amount.points.out { color: #ff6b6b; }
.ledger-amount.money.in { color: var(--primary); }
.ledger-amount.points.in { color: #ffc107; }
.ledger-amount.coupon.in { color: #4facfe; }
.ledger-balance { font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; }
.reversed-tag { font-style: normal; font-size: 0.65rem; font-weight: 600; color: #ffc107; border: 1px solid rgba(255,193,7,0.4); border-radius: 4px; padding: 0 4px; margin-left: 6px; vertical-align: middle; }
.ledger-empty { text-align: center; padding: 2rem 1rem; color: var(--text-secondary); }
.empty-icon-small { font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.6; }
.ledger-empty p { font-size: 0.85rem; }

.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; transition: all 0.3s; }
.stat-card:hover { border-color: rgba(255, 255, 255, 0.15); transform: translateY(-2px); }
.stat-icon { font-size: 2rem; }
.stat-content { display: flex; flex-direction: column; }
.stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 1.75rem; font-weight: 700; color: var(--primary); line-height: 1; }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem; }
.bookings-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.bookings-list { display: flex; flex-direction: column; gap: 0.75rem; }
.booking-card { display: flex; align-items: center; gap: 1.25rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 14px; transition: all 0.3s; cursor: pointer; }
.booking-card:hover { background: rgba(255, 255, 255, 0.04); }
.booking-date { display: flex; flex-direction: column; align-items: center; min-width: 50px; }
.booking-date .day { font-family: 'Space Grotesk', sans-serif; font-size: 1.5rem; font-weight: 700; line-height: 1; }
.booking-date .month { font-size: 0.75rem; color: var(--text-secondary); }
.booking-info { flex: 1; }
.booking-info h4 { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.25rem; }
.booking-time { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; color: var(--text-secondary); }
.booking-time svg { width: 14px; height: 14px; }
.booking-status { padding: 0.4rem 0.8rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
.booking-status.upcoming { background: rgba(0, 217, 165, 0.15); color: var(--primary); }
.booking-status.completed { background: rgba(108, 117, 125, 0.15); color: #6c757d; }
.booking-status.cancelled { background: rgba(255, 107, 107, 0.15); color: #ff6b6b; }
.actions-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; }
.actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.action-card { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: rgba(255, 255, 255, 0.02); border-radius: 12px; cursor: pointer; transition: all 0.3s; }
.action-card:hover { background: rgba(255, 255, 255, 0.05); }
.action-icon { font-size: 1.25rem; }
.action-name { flex: 1; font-size: 0.9rem; }
.action-arrow { width: 16px; height: 16px; color: var(--text-muted); transition: transform 0.3s; }
.action-card:hover .action-arrow { transform: translateX(3px); color: var(--primary); }
.edit-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
.form-group label { font-size: 0.85rem; color: var(--text-secondary); }
.form-group input { background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; color: var(--text-primary); font-size: 0.9rem; }
.form-group input:focus { outline: none; border-color: var(--primary); }

/* 充值 */
.recharge-form { display: flex; flex-direction: column; gap: 1rem; }
.recharge-amount { font-family: 'Space Grotesk', sans-serif; font-size: 2.2rem; font-weight: 700; color: var(--primary); text-align: center; }
.recharge-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
.recharge-chip { padding: 0.7rem 0; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; color: var(--text-primary); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.recharge-chip.active { background: rgba(0, 217, 165, 0.15); border-color: var(--primary); color: var(--primary); }
.recharge-balance-line { font-size: 0.8rem; color: var(--text-secondary); text-align: center; }

/* 优惠券 */
.coupon-list { display: flex; flex-direction: column; gap: 0.75rem; max-height: 480px; overflow-y: auto; }
.coupon-card { position: relative; display: flex; align-items: stretch; background: rgba(255,255,255,0.03); border: 1px solid rgba(0,217,165,0.2); border-radius: 14px; overflow: hidden; }
.coupon-card.used { opacity: 0.5; border-color: var(--border); }
.coupon-amount { width: 110px; flex-shrink: 0; display: flex; align-items: baseline; justify-content: center; background: rgba(0,217,165,0.12); padding: 1.25rem 0.5rem; }
.coupon-amount .cny { font-size: 0.9rem; font-weight: 700; color: var(--primary); }
.coupon-amount .num { font-family: 'Space Grotesk', sans-serif; font-size: 2rem; font-weight: 700; color: var(--primary); }
.coupon-divider { width: 1px; border-left: 1px dashed var(--border); margin: 0.75rem 0; }
.coupon-info { flex: 1; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.2rem; }
.coupon-info h4 { font-size: 0.95rem; }
.coupon-info p { font-size: 0.8rem; color: var(--text-secondary); }
.coupon-expire { font-size: 0.72rem; color: var(--text-muted); }
.coupon-used-tag { position: absolute; top: 10px; right: 12px; font-size: 0.72rem; color: var(--text-muted); border: 1px solid var(--text-muted); border-radius: 6px; padding: 1px 6px; }

/* 明细弹窗 */
.records-modal-list { max-height: 460px; }
.ledger-modal-record { align-items: center; }
.record-right { display: flex; flex-direction: column; align-items: flex-end; }
.record-sub { font-size: 0.7rem; color: var(--text-muted); }

.points-list { display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; }
.points-record { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.record-info { display: flex; flex-direction: column; }
.record-title { font-size: 0.9rem; font-weight: 500; }
.record-date { font-size: 0.75rem; color: var(--text-muted); }
.record-amount { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; font-weight: 700; }
.record-amount.add { color: var(--primary); }
.record-amount.minus { color: #ff6b6b; }
.exchange-list { display: flex; flex-direction: column; gap: 0.75rem; }
.gift-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.gift-icon { font-size: 2rem; }
.gift-info { flex: 1; }
.gift-info h4 { font-size: 0.95rem; font-weight: 500; margin-bottom: 0.2rem; }
.gift-points { font-size: 0.8rem; color: var(--primary); }
.btn-exchange { background: var(--gradient-1); border: none; color: var(--bg-dark); padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
.btn-exchange:disabled { background: var(--bg-card-hover); color: var(--text-muted); cursor: not-allowed; }
.booking-detail { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(255, 255, 255, 0.03); border-radius: 12px; }
.detail-row { display: flex; justify-content: space-between; font-size: 0.9rem; }
.detail-row .label { color: var(--text-secondary); }
.detail-row .value { font-weight: 500; }
.detail-row .value.status.upcoming { color: var(--primary); }
.detail-row .value.status.completed { color: #6c757d; }
.detail-row .value.status.cancelled { color: #ff6b6b; }
@media (max-width: 1100px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 900px) { .profile-layout { grid-template-columns: 1fr; } .profile-sidebar { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; } .user-card { grid-column: 1 / -1; } .profile-nav { grid-column: 1 / -1; } .actions-grid { grid-template-columns: repeat(2, 1fr); } .assets-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) { .profile-page { padding: 1rem 1.5rem 3rem; } .profile-sidebar { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } .actions-grid { grid-template-columns: 1fr; } .wallet-hero-balance { font-size: 2.3rem; } .recharge-options { grid-template-columns: repeat(2, 1fr); } }
</style>
