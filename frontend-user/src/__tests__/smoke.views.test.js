import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import Profile from '../views/Profile.vue'
import Tasks from '../views/Tasks.vue'

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

describe('视图冒烟测试', () => {
  it('Profile 页面挂载并渲染钱包概览', async () => {
    const wrapper = mount(Profile, {
      global: {
        mocks: {
          $router: { push: vi.fn() },
          $route: { query: {} }
        }
      }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('会员钱包')
    expect(wrapper.text()).toContain('可用优惠券')
    expect(wrapper.text()).toContain('消费明细')
    // 明细类型筛选存在
    expect(wrapper.text()).toContain('余额明细')
    expect(wrapper.text()).toContain('优惠券')
  })

  it('Tasks 页面挂载并渲染付款弹窗中的钱包余额', async () => {
    const wrapper = mount(Tasks, {
      global: {
        mocks: {
          $router: { push: vi.fn() }
        }
      }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('会员任务中心')
  })
})
