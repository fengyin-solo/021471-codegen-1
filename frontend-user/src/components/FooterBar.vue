<!--
  FooterBar.vue - 全局页脚组件
  
  功能说明：
  - 显示品牌信息
  - 提供快捷导航链接
  - 显示版权信息
-->
<template>
  <footer class="footer">
    <div class="footer-content">
      <!-- 品牌名称 -->
      <div class="footer-brand">
        <span>BILLIARD</span><span class="accent">CLUB</span>
      </div>
      
      <!-- 快捷链接 -->
      <div class="footer-links">
        <router-link to="/tables">球桌预约</router-link>
        <router-link to="/courses">教学课程</router-link>
        <router-link to="/competitions">赛事活动</router-link>
        <router-link to="/shop">装备商城</router-link>
      </div>
      
      <!-- 版权信息 -->
      <p class="copyright">© {{ currentYear }} BilliardClub. All rights reserved.</p>
    </div>
  </footer>
</template>

<script>
/**
 * 页脚组件
 * 显示品牌、导航链接和版权信息
 */
export default {
  name: 'FooterBar',
  computed: {
    /**
     * 获取当前年份
     * 用于版权信息动态显示
     */
    currentYear() {
      return new Date().getFullYear()
    }
  }
}
</script>

<style scoped>
.footer {
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  padding: 3rem 0;
  margin-top: 4rem;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 3rem;
  text-align: center;
}

.footer-brand {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.accent {
  color: var(--primary);
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.3s;
}

.footer-links a:hover {
  color: var(--primary);
}

.copyright {
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>
