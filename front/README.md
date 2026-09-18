# 费曼学习平台前端

React + Vite 前端工程，位于项目根目录的 `front/`。

## 当前功能

- React + Vite 基础工程
- `react-router-dom` 客户端路由
- 登录、注册页面
- React Context + `localStorage` 登录状态
- 路由守卫：未登录时不能访问学习空间
- Axios API 客户端，自动携带 `x-auth-token`
- 学习概览页
- 知识点列表、搜索、创建和删除
- 知识点状态：未开始、学习中、已掌握
- 响应式布局，支持桌面端和移动端窗口

## 启动前端

从前端目录执行：

```bash
cd /Users/acnlvou/Desktop/Android/feynman-platform/front
npm install
npm run dev
```

浏览器打开：

<http://localhost:5173>

## 启动后端

另开一个终端：

```bash
cd /Users/acnlvou/Desktop/Android/feynman-platform/backend
npm start
```

后端默认地址：

<http://localhost:3000>

前端默认请求地址是：

```text
http://localhost:3000/api
```

如果后端地址发生变化，可以在 `front/` 下创建 `.env.local`：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## 测试流程

1. 先启动后端，再启动前端。
2. 打开 `http://localhost:5173/register` 注册账号。
3. 注册成功后会自动进入学习概览页。
4. 进入“我的知识点”，创建一条知识点。
5. 刷新页面，确认登录状态和知识点仍然存在。
6. 点击退出登录，再访问学习空间，确认会跳转到登录页。

真实的 `backend/.env` 和前端本地 `.env.local` 不要提交到 Git。
