import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Tasks from '../views/Tasks.vue'
import { walletState, walletStore } from '../utils/walletStore'
import { taskStore } from '../utils/taskStore'
import { authState } from '../utils/auth'

const store = {}
Object.defineProperty(global, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
    clear: () => Object.keys(store).forEach((k) => delete store[k])
  }
})

vi.mock('../utils/api', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

// Modal 通过 Teleport 渲染到 body，按钮需从 document 查找
const bodyButtons = () => Array.from(document.body.querySelectorAll('button'))
const findButton = (text) => bodyButtons().find((b) => b.textContent.includes(text))

function mountTasks() {
  return mount(Tasks, {
    global: {
      mocks: { $router: { push: vi.fn() } }
    },
    attachTo: document.body
  })
}

describe('任务中心付款端到端（钱包）', () => {
  beforeEach(() => {
    localStorage.clear()
    walletStore.reset()
    walletStore.init()
    authState.isLoggedIn = true
    authState.token = 'test_token'
    authState.user = { id: 'U1', name: '测试', points: 1000 }
    taskStore.clearAll()
    walletState.balance = 500
    walletState.ledger.splice(0, walletState.ledger.length)
    document.body.innerHTML = ''
  })

  it('余额不足：付款弹窗显示差额提示且确认按钮禁用', async () => {
    taskStore.add({
      type: 'order',
      title: '高价球杆',
      subtitle: '待付款',
      amount: 9999,
      status: 'pending_payment',
      extra: { orderNo: 'SP1' }
    })
    const wrapper = mountTasks()
    await flushPromises()

    await findButton('继续付款').click()
    await flushPromises()

    expect(document.body.textContent).toContain('余额不足')
    expect(findButton('余额支付').disabled).toBe(true)

    wrapper.unmount()
  })

  it('余额充足：确认支付后扣款并流转任务状态', async () => {
    const task = taskStore.add({
      type: 'booking',
      title: '1号球桌 - 斯诺克',
      subtitle: '待付款',
      amount: 160,
      status: 'pending_payment',
      extra: { orderNo: 'BK9' }
    })
    const wrapper = mountTasks()
    await flushPromises()

    await findButton('继续付款').click()
    await flushPromises()

    const confirmBtn = findButton('余额支付')
    expect(confirmBtn.disabled).toBe(false)
    confirmBtn.click()
    await new Promise((r) => setTimeout(r, 1000))
    await flushPromises()

    expect(walletState.balance).toBe(340)
    const stored = taskStore.getById(task.id)
    expect(['upcoming', 'pending_shipment']).toContain(stored.status)
    expect(document.body.textContent).toContain('支付成功')

    wrapper.unmount()
  })
})
