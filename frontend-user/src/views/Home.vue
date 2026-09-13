<template>
  <div class="home">
    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-bg">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
        <div class="grid-overlay"></div>
      </div>
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          <span>专业台球俱乐部</span>
        </div>
        <h1 class="hero-title">
          <span class="line">体验极致</span>
          <span class="line highlight">台球艺术</span>
        </h1>
        <p class="hero-desc">
          顶级球桌设备 · 专业教练团队 · 精彩赛事活动<br>
          开启您的台球之旅
        </p>
        <div class="hero-actions">
          <button class="btn-primary" @click="$router.push('/tables')">
            <span>立即预约</span>
            <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
          <button class="btn-secondary" @click="$router.push('/courses')">
            <span>探索课程</span>
          </button>
        </div>
        <div class="hero-stats">
          <div class="stat-item">
            <span class="stat-number">50<span class="plus">+</span></span>
            <span class="stat-label">专业球桌</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">10K<span class="plus">+</span></span>
            <span class="stat-label">注册会员</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-number">200<span class="plus">+</span></span>
            <span class="stat-label">赛事举办</span>
          </div>
        </div>
      </div>
      <div class="hero-visual">
        <div class="visual-card">
          <div class="card-glow"></div>
          <div class="billiard-animation">
            <div class="table-surface">
              <div class="ball ball-cue"></div>
              <div class="ball ball-1"></div>
              <div class="ball ball-2"></div>
              <div class="ball ball-3"></div>
              <div class="ball ball-8"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="section-header">
        <span class="section-tag">我们的服务</span>
        <h2 class="section-title">为什么选择我们</h2>
      </div>
      <div class="features-grid">
        <div v-for="(feature, index) in features" :key="index" class="feature-card" @click="goToFeature(feature)">
          <div class="feature-icon">
            <div class="icon-bg"></div>
            <span>{{ feature.icon }}</span>
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.desc }}</p>
          <div class="feature-link">
            <span>了解更多</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="cta">
      <div class="cta-content">
        <div class="cta-bg">
          <div class="cta-orb"></div>
        </div>
        <h2>准备好开始了吗？</h2>
        <p>加入我们，体验专业台球的魅力</p>
        <button class="btn-cta" @click="$router.push('/tables')">
          <span>开始预约</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'Home',
  data() {
    return {
      features: [
        { icon: '🎱', title: '顶级球桌', desc: '进口星牌、乔氏球桌，国际比赛标准配置，为您提供最佳击球体验', link: '/tables' },
        { icon: '👨‍🏫', title: '专业教练', desc: '国家级认证教练团队，一对一定制教学，快速提升您的球技水平', link: '/courses' },
        { icon: '🏆', title: '精彩赛事', desc: '定期举办各类台球比赛，从业余到专业，让您在竞技中成长', link: '/competitions' },
        { icon: '🛒', title: '装备商城', desc: '正品台球装备一站式购买，从球杆到配件，品质保证', link: '/shop' }
      ]
    }
  },
  methods: {
    /**
     * 跳转到功能页面
     * @param {Object} feature - 功能对象，包含 link 属性
     */
    goToFeature(feature) {
      this.$router.push(feature.link)
      // 跳转后滚动到页面顶部
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 3rem;
}

/* Hero Section */
.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  min-height: calc(100vh - 200px);
  align-items: center;
  position: relative;
  padding: 2rem 0;
}

.hero-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
}

.orb-1 {
  width: 600px;
  height: 600px;
  background: var(--primary);
  top: -200px;
  right: -100px;
  opacity: 0.15;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: #667eea;
  bottom: -100px;
  left: -100px;
  opacity: 0.1;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0, 217, 165, 0.1);
  border: 1px solid rgba(0, 217, 165, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  font-size: 0.85rem;
  color: var(--primary);
  margin-bottom: 1.5rem;
}

.badge-dot {
  width: 8px;
  height: 8px;
  background: var(--primary);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.hero-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 4.5rem;
  font-weight: 700;
  line-height: 1.1;
  margin-bottom: 1.5rem;
}

.hero-title .line {
  display: block;
}

.hero-title .highlight {
  background: var(--gradient-1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  font-size: 1.1rem;
  color: var(--text-secondary);
  line-height: 1.8;
  margin-bottom: 2.5rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 3rem;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--gradient-1);
  color: var(--bg-dark);
  border: none;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 40px var(--primary-glow);
}

.btn-arrow {
  width: 20px;
  height: 20px;
  transition: transform 0.3s;
}

.btn-primary:hover .btn-arrow {
  transform: translateX(4px);
}

.btn-secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border);
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 500;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-secondary:hover {
  background: var(--bg-card);
  border-color: var(--text-muted);
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.stat-item {
  text-align: left;
}

.stat-number {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-number .plus {
  color: var(--primary);
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.stat-divider {
  width: 1px;
  height: 50px;
  background: var(--border);
}

/* Hero Visual */
.hero-visual {
  position: relative;
  z-index: 1;
}

.visual-card {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 3rem;
  overflow: hidden;
}

.card-glow {
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
  pointer-events: none;
}

.billiard-animation {
  position: relative;
  aspect-ratio: 16/10;
}

.table-surface {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%);
  border-radius: 12px;
  border: 8px solid #5D4037;
  position: relative;
  box-shadow: inset 0 0 30px rgba(0,0,0,0.3);
}

.ball {
  position: absolute;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  box-shadow: 
    inset -3px -3px 8px rgba(0,0,0,0.3),
    2px 2px 4px rgba(0,0,0,0.2);
}

.ball-cue {
  background: linear-gradient(135deg, #fff 0%, #e0e0e0 100%);
  bottom: 30%;
  left: 20%;
  animation: moveCue 4s ease-in-out infinite;
}

.ball-1 {
  background: linear-gradient(135deg, #FDD835 0%, #F9A825 100%);
  top: 40%;
  right: 35%;
}

.ball-2 {
  background: linear-gradient(135deg, #1E88E5 0%, #1565C0 100%);
  top: 30%;
  right: 25%;
}

.ball-3 {
  background: linear-gradient(135deg, #E53935 0%, #C62828 100%);
  top: 50%;
  right: 30%;
}

.ball-8 {
  background: linear-gradient(135deg, #212121 0%, #000 100%);
  top: 40%;
  right: 40%;
}

.ball-8::after {
  content: '8';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #000;
  font-weight: bold;
}

@keyframes moveCue {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(20px, -10px); }
}

/* Features Section */
.features {
  padding: 6rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 4rem;
}

.section-tag {
  display: inline-block;
  background: rgba(0, 217, 165, 0.1);
  color: var(--primary);
  padding: 0.5rem 1rem;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.section-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 3rem;
  font-weight: 700;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.feature-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 2rem;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-8px);
  border-color: var(--primary);
  box-shadow: var(--shadow-glow);
}

.feature-icon {
  position: relative;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.icon-bg {
  position: absolute;
  inset: 0;
  background: var(--gradient-1);
  border-radius: 16px;
  opacity: 0.1;
  transition: opacity 0.3s;
}

.feature-card:hover .icon-bg {
  opacity: 0.2;
}

.feature-icon span {
  font-size: 1.75rem;
  position: relative;
  z-index: 1;
}

.feature-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.feature-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.feature-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.feature-link svg {
  width: 16px;
  height: 16px;
  transition: transform 0.3s;
}

.feature-card:hover .feature-link svg {
  transform: translateX(4px);
}

/* CTA Section */
.cta {
  padding: 4rem 0;
}

.cta-content {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 32px;
  padding: 5rem;
  text-align: center;
  overflow: hidden;
}

.cta-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cta-orb {
  position: absolute;
  width: 500px;
  height: 500px;
  background: var(--primary);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  filter: blur(150px);
  opacity: 0.15;
}

.cta-content h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
  position: relative;
}

.cta-content p {
  color: var(--text-secondary);
  font-size: 1.1rem;
  margin-bottom: 2rem;
  position: relative;
}

.btn-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--gradient-1);
  color: var(--bg-dark);
  border: none;
  padding: 1.25rem 2.5rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.btn-cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 50px var(--primary-glow);
}

.btn-cta svg {
  width: 20px;
  height: 20px;
  transition: transform 0.3s;
}

.btn-cta:hover svg {
  transform: translateX(4px);
}

@media (max-width: 1200px) {
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    text-align: center;
  }
  
  .hero-title {
    font-size: 3rem;
  }
  
  .hero-actions {
    justify-content: center;
  }
  
  .hero-stats {
    justify-content: center;
  }
  
  .hero-visual {
    display: none;
  }
}

@media (max-width: 600px) {
  .home {
    padding: 0 1.5rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
}
</style>
