<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast-container" :class="type">
        <div class="toast-icon">
          <svg v-if="type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <svg v-else-if="type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <svg v-else-if="type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div class="toast-content">
          <p class="toast-title">{{ title }}</p>
          <p v-if="message" class="toast-message">{{ message }}</p>
        </div>
        <button class="toast-close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="toast-progress" :style="{ animationDuration: duration + 'ms' }"></div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    modelValue: Boolean,
    type: { type: String, default: 'info' },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    duration: { type: Number, default: 3000 }
  },
  emits: ['update:modelValue'],
  computed: {
    visible: {
      get() { return this.modelValue },
      set(val) { this.$emit('update:modelValue', val) }
    }
  },
  watch: {
    visible(val) {
      if (val && this.duration > 0) {
        setTimeout(() => this.close(), this.duration)
      }
    }
  },
  methods: {
    close() {
      this.visible = false
    }
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 100px;
  right: 24px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px 20px;
  min-width: 320px;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  z-index: 9999;
  overflow: hidden;
}

.toast-container.success {
  border-color: rgba(0, 217, 165, 0.3);
}

.toast-container.error {
  border-color: rgba(255, 107, 107, 0.3);
}

.toast-container.warning {
  border-color: rgba(255, 193, 7, 0.3);
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
}

.toast-icon svg {
  width: 100%;
  height: 100%;
}

.toast-container.success .toast-icon {
  color: var(--primary);
}

.toast-container.error .toast-icon {
  color: #ff6b6b;
}

.toast-container.warning .toast-icon {
  color: #ffc107;
}

.toast-container.info .toast-icon {
  color: #4facfe;
}

.toast-content {
  flex: 1;
}

.toast-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 2px;
}

.toast-message {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.toast-close {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.toast-close svg {
  width: 16px;
  height: 16px;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--primary);
  animation: progress linear forwards;
}

.toast-container.error .toast-progress {
  background: #ff6b6b;
}

.toast-container.warning .toast-progress {
  background: #ffc107;
}

.toast-container.info .toast-progress {
  background: #4facfe;
}

@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}

.toast-enter-active {
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-leave-active {
  animation: slideOut 0.3s cubic-bezier(0.4, 0, 1, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}
</style>
