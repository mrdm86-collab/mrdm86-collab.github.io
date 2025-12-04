// GitHub OAuth Handler for GitHub Pages
// This file handles the authentication flow for static deployment

// Configuration
const CONFIG = {
  clientId: 'Ov23li11LuFcZ8IYzRz2', // GitHub OAuth App Client ID
  redirectUri: `${window.location.origin}/admin/callback`,
  scope: 'user:email repo',
  apiBaseUrl: 'https://api.github.com',
  // 本地开发时的 API 地址
  localApiUrl: 'http://localhost:4323'
};

// 检测是否为本地开发环境
const isLocal = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.hostname.startsWith('192.168.') ||
                window.location.hostname.startsWith('10.');

// API 基础 URL
const API_BASE = isLocal ? CONFIG.localApiUrl : CONFIG.apiBaseUrl;

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('github_token');
    this.user = JSON.parse(localStorage.getItem('github_user') || 'null');
  }

  // 生成 GitHub OAuth URL
  getAuthUrl() {
    const params = new URLSearchParams({
      client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri,
      scope: CONFIG.scope,
      state: this.generateState()
    });

    return `https://github.com/login/oauth/authorize?${params}`;
  }

  // 生成随机 state 参数
  generateState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // 启动 GitHub OAuth 流程
  async login() {
    const authUrl = this.getAuthUrl();
    localStorage.setItem('oauth_state', authUrl.split('state=')[1]);
    window.location.href = authUrl;
  }

  // 处理 OAuth 回调
  async handleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const savedState = localStorage.getItem('oauth_state');

    if (!code || state !== savedState) {
      throw new Error('Invalid OAuth callback');
    }

    try {
      // 在生产环境中，这需要通过后端服务处理
      // 现在先模拟一个成功的认证
      if (isLocal) {
        // 本地开发：调用后端 API
        const response = await fetch(`${API_BASE}/auth/github/callback?code=${code}&state=${state}`);
        const data = await response.json();

        if (data.token) {
          this.token = data.token;
          this.user = data.user;
          localStorage.setItem('github_token', this.token);
          localStorage.setItem('github_user', JSON.stringify(this.user));
          return true;
        }
      } else {
        // GitHub Pages 部署：模拟认证（需要真实后端服务）
        // 这里可以集成一个无服务器函数或第三方认证服务
        await this.simulateAuth();
        return true;
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      throw error;
    }
  }

  // 模拟认证（仅用于演示）
  async simulateAuth() {
    // 这是一个模拟的认证，实际使用时需要真实的后端服务
    this.user = {
      id: 123456,
      username: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.com',
      avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
    };
    this.token = 'demo-token-' + Date.now();

    localStorage.setItem('github_token', this.token);
    localStorage.setItem('github_user', JSON.stringify(this.user));
  }

  // 检查认证状态
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // 获取用户信息
  getUser() {
    return this.user;
  }

  // 退出登录
  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('github_token');
    localStorage.removeItem('github_user');
    localStorage.removeItem('oauth_state');
    window.location.href = '/admin/login';
  }

  // API 请求封装
  async apiRequest(endpoint, options = {}) {
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Authentication expired');
    }

    return response.json();
  }
}

// 全局认证管理器实例
const auth = new AuthManager();

// 页面加载时检查认证状态
document.addEventListener('DOMContentLoaded', async () => {
  const currentPath = window.location.pathname;

  // 处理 OAuth 回调
  if (currentPath === '/admin/callback') {
    try {
      await auth.handleCallback();
      window.location.href = '/admin/dashboard';
    } catch (error) {
      console.error('Authentication failed:', error);
      window.location.href = '/admin/login?error=auth_failed';
    }
    return;
  }

  // 检查是否需要认证
  if (currentPath.startsWith('/admin/dashboard') || currentPath.startsWith('/admin/')) {
    if (!auth.isAuthenticated()) {
      window.location.href = '/admin/login';
      return;
    }

    // 更新页面中的用户信息
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');

    if (userName) userName.textContent = auth.getUser().name || auth.getUser().username;
    if (userEmail) userEmail.textContent = auth.getUser().email || '';
    if (userAvatar && auth.getUser().avatar_url) {
      userAvatar.innerHTML = `<img src="${auth.getUser().avatar_url}" alt="Avatar" class="w-full h-full rounded-full object-cover">`;
    }
  }
});

// 导出到全局
window.authManager = auth;