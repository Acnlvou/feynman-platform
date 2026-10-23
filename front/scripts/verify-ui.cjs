// 浏览器隔离回归：所有 /api/ 请求由测试数据接管，不写真实数据库。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const fs = require('node:fs'),
  assert = require('node:assert/strict')
const out =
  process.env.TEST_ARTIFACTS ||
  require('node:path').resolve(__dirname, '../../.tmp/ui-redesign')
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
let runningBrowser
fs.mkdirSync(out, { recursive: true })
const fixtureBody =
  '# 用自己的话，解释一个概念\n\n理解的关键在于把复杂问题拆成简单步骤。\n\n| 步骤 | 目标 |\n| --- | --- |\n| 记录 | 整理输入 |\n| 复述 | 检验理解 |\n\n数学公式：$E=mc^2$\n\n```js\nconst understanding = learning + practice;\n```\n\n```mermaid\ngraph LR\n A[学习] --> B[解释]\n B --> C[发现问题]\n```'
let points = Array.from({ length: 7 }, (_, i) => ({
  _id: 'note-' + i,
  title: [
    '费曼学习法：把知识变成自己的理解',
    'JavaScript 闭包与作用域',
    '理解 HTTP 请求与响应',
    'React 中的状态管理',
    '线性代数：从向量到矩阵',
    '如何建立长期学习习惯',
    '长标题测试：' + '理解知识与重新组织思路'.repeat(8),
  ][i],
  content: fixtureBody,
  status: ['in_progress', 'mastered', 'not_started'][i % 3],
  reviewList: i === 0,
  createdAt: '2026-10-10T12:00:00Z',
  updatedAt: `2026-10-${20 - i}T12:00:00Z`,
}))
const token =
  Buffer.from('{}').toString('base64url') +
  '.' +
  Buffer.from(
    JSON.stringify({
      user: { id: 'test-user', username: 'Learner' },
      exp: 9999999999,
    }),
  ).toString('base64url') +
  '.fixture'
;(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {}),
  })
  runningBrowser = browser
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  })
  const page = await context.newPage()
  let failList = false,
    failSave = false
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.log('PAGE ERROR', e.message)
  })
  const passed = []
  const push = passed.push.bind(passed)
  passed.push = (...items) => {
    console.log(items.join(', '))
    return push(...items)
  }
  async function dialogAction(action, accept) {
    await Promise.all([
      page
        .waitForEvent('dialog')
        .then((d) => (accept ? d.accept() : d.dismiss())),
      action(),
    ])
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    )
  }
  await context.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method()
    if (method === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    let status = 200,
      data = null,
      message = '成功'
    if (url.pathname.includes('/users/')) {
      data = { token }
    } else if (method === 'GET' && url.pathname === '/api/knowledge-points') {
      if (failList) {
        status = 503
        message = '隔离测试：数据库暂不可用'
      } else data = points
    } else {
      const id = url.pathname.split('/').pop(),
        p = points.find((p) => p._id === id)
      if (id === 'forbidden') {
        status = 403
        message = '无权访问'
      } else if (method === 'POST') {
        if (failSave) {
          status = 503
          message = '隔离测试：保存失败'
        } else {
          data = {
            ...req.postDataJSON(),
            _id: 'created',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          points.unshift(data)
        }
      } else if (!p) {
        status = 404
        message = '记录不存在'
      } else if (method === 'PUT') {
        Object.assign(p, req.postDataJSON(), {
          updatedAt: new Date().toISOString(),
        })
        data = p
      } else if (method === 'DELETE') {
        points = points.filter((item) => item._id !== id)
      } else data = p
    }
    return route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*' },
      json: { success: status < 400, data, message, error: null },
    })
  })
  await page.goto(base + '/knowledge/note-0?source=test')
  await page.waitForURL('**/login')
  await page.getByLabel('邮箱', { exact: true }).fill('demo@example.invalid')
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '登录平台' }).click()
  await page.waitForURL('**/knowledge/note-0?source=test')
  passed.push('登录保留目标页和查询参数')
  await page.screenshot({ path: out + '/initial-detail.png', fullPage: true })
  await page.locator('.mermaid-block svg').waitFor()
  assert.equal(await page.locator('.markdown-body table').count(), 1)
  assert.ok(await page.locator('.katex').count())
  passed.push('Markdown 表格、公式、代码及 Mermaid')
  await page.goto(base + '/')
  await page.waitForURL('**/knowledge')
  await page.locator('.knowledge-item').first().waitFor()
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({
      path: `${out}/knowledge-${width}.png`,
      fullPage: true,
    })
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `library overflow ${width}`,
    )
  }
  passed.push('知识库 1440/1024/390 无横向溢出')
  await page.getByLabel('搜索知识点').fill('闭包')
  assert.equal(await page.locator('.knowledge-item').count(), 1)
  await page.getByLabel('搜索知识点').fill('')
  await page.getByLabel('筛选状态').selectOption('mastered')
  assert.equal(await page.locator('.knowledge-item').count(), 2)
  await page.getByLabel('筛选状态').selectOption('all')
  passed.push('搜索与状态筛选')
  await page.getByRole('link', { name: '学习概览' }).click()
  await page.locator('.recent-row').first().waitFor()
  assert.equal(await page.locator('.recent-row').count(), 5)
  assert.match(await page.locator('.stat-card').first().innerText(), /7/)
  await page.screenshot({ path: `${out}/overview-mobile.png`, fullPage: true })
  passed.push('接口响应统计与最近 5 条（隔离数据）')
  await page.getByRole('link', { name: '新建知识点' }).click()
  await page.getByLabel('知识点标题').fill('新增测试')
  await page.getByLabel('知识点正文').fill(fixtureBody)
  await page.getByRole('tab', { name: '预览', exact: true }).click()
  await page.locator('.editor-preview .mermaid-block svg').waitFor()
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  )
  await page.screenshot({ path: `${out}/editor-mobile.png`, fullPage: true })
  await page.getByRole('tab', { name: '编辑', exact: true }).click()
  await dialogAction(
    () => page.getByRole('button', { name: '取消', exact: true }).click(),
    false,
  )
  assert.match(page.url(), /\/new$/)
  passed.push('未保存取消离开保留输入')
  failSave = true
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await page.getByRole('alert').waitFor()
  assert.equal(await page.getByLabel('知识点标题').inputValue(), '新增测试')
  failSave = false
  await page.getByRole('button', { name: '保存知识点', exact: true }).click()
  await page.waitForURL('**/knowledge/created')
  passed.push('保存失败保留输入，成功进入详情')
  await page.getByRole('link', { name: '编辑', exact: true }).click()
  await page.getByLabel('知识点标题').fill('已修改测试')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('.editor-preview .mermaid-block svg').waitFor()
  assert.ok(await page.getByLabel('知识点正文').isVisible())
  assert.ok(await page.getByRole('region', { name: '实时预览' }).isVisible())
  await page.screenshot({ path: `${out}/editor-desktop.png`, fullPage: true })
  await page.getByRole('button', { name: '保存修改', exact: true }).click()
  await page.waitForURL('**/knowledge/created')
  await page.getByRole('heading', { name: '已修改测试', exact: true }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: '已修改测试', exact: true }).waitFor()
  passed.push('编辑、双栏实时预览及刷新读回')
  await dialogAction(
    () => page.getByRole('button', { name: '删除', exact: true }).click(),
    false,
  )
  assert.match(page.url(), /created$/)
  await dialogAction(
    () => page.getByRole('button', { name: '删除', exact: true }).click(),
    true,
  )
  await page.waitForURL('**/knowledge')
  passed.push('删除取消与确认')
  failList = true
  await page.reload()
  await page.getByRole('heading', { name: '暂时无法加载知识库' }).waitFor()
  assert.equal(
    await page.getByText('从第一个知识点开始', { exact: true }).count(),
    0,
  )
  failList = false
  await page.getByRole('button', { name: '重新加载' }).click()
  await page.locator('.knowledge-item').first().waitFor()
  passed.push('加载失败与重试')
  for (const id of ['missing', 'forbidden']) {
    await page.goto(base + '/knowledge/' + id)
    await page.getByRole('heading', { name: '无法打开这个知识点' }).waitFor()
  }
  passed.push('404/403 页面')
  await page.goto(base + '/knowledge/note-6')
  await page.locator('.mermaid-block svg').waitFor()
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `detail overflow ${width}`,
    )
    await page.screenshot({
      path: `${out}/detail-${width}.png`,
      fullPage: true,
    })
  }
  passed.push('长标题与详情三种宽度')
  await page.getByRole('button', { name: '账号菜单' }).click()
  await page.keyboard.press('Escape')
  assert.equal(
    await page
      .getByRole('button', { name: '账号菜单' })
      .getAttribute('aria-expanded'),
    'false',
  )
  await page.getByRole('button', { name: '账号菜单' }).click()
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.waitForURL('**/login')
  await page.getByRole('heading', { name: '登录学习空间' }).waitFor()
  await page.screenshot({ path: `${out}/login-mobile.png`, fullPage: true })
  await page.getByRole('link', { name: '创建一个账号' }).click()
  await page.goto(base + '/register?direct=1')
  await page.getByLabel('用户名', { exact: true }).fill('Demo')
  await page.getByLabel('邮箱', { exact: true }).fill('demo@example.invalid')
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '创建账号', exact: true }).click()
  await page.waitForURL('**/knowledge')
  passed.push('手机账号菜单、Escape、退出、注册默认跳转')
  for (const route of [
    '/overview',
    '/knowledge/new',
    '/knowledge/note-0/edit',
  ]) {
    await page.goto(base + route)
    await page.getByRole('heading', { level: 1 }).waitFor()
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route + ' overflow ' + width,
      )
      if (route !== '/overview') {
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), route + ' page must not scroll')
        const save = await page.getByRole('region', { name: '保存操作' }).evaluate(el => {
          const rect = el.getBoundingClientRect()
          return rect.top >= 0 && rect.bottom <= innerHeight
        })
        assert.ok(save, route + ' save actions must remain visible')
      }
    }
  }
  await page.getByLabel('知识点标题').fill('未保存的修改')
  await dialogAction(
    () => page.getByRole('link', { name: '知识库', exact: true }).click(),
    false,
  )
  assert.match(page.url(), /edit$/)
  await dialogAction(
    () => page.getByRole('link', { name: '知识库', exact: true }).click(),
    true,
  )
  await page.waitForURL('**/knowledge')
  passed.push('未保存提醒取消和确认、站内导航')
  await page.getByRole('link', { name: '新建知识点', exact: true }).click()
  await page.getByLabel('知识点标题').fill('未保存退出测试')
  await page.getByRole('button', { name: '账号菜单' }).click()
  await dialogAction(
    () => page.getByRole('button', { name: '退出登录' }).click(),
    false,
  )
  assert.match(page.url(), /new$/)
  let exitPrompts = 0
  const acceptExit = (d) => {
    exitPrompts++
    d.accept()
  }
  page.on('dialog', acceptExit)
  await page.getByRole('button', { name: '退出登录' }).click()
  await page.waitForURL('**/login')
  page.off('dialog', acceptExit)
  passed.push('编辑时退出确认，提示次数 ' + exitPrompts)
  for (const route of ['/login', '/register']) {
    await page.goto(base + route)
    await page.getByRole('heading', { level: 1 }).waitFor()
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      )
      await page.screenshot({
        path: out + route + '-' + width + '.png',
        fullPage: true,
      })
    }
  }
  passed.push('全部页面三种宽度检查')
  await page.goto(base + '/login')
  await page.getByLabel('邮箱', { exact: true }).fill('demo@example.invalid')
  await page.getByLabel('密码', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: '登录平台' }).click()
  await page.waitForURL('**/knowledge')
  points = []
  await page.reload()
  await page.getByRole('heading', { name: '从第一个知识点开始' }).waitFor()
  passed.push('空数据库状态')
  assert.deepEqual(errors, [])
  const report = {
    passed,
    errors,
    scope: '浏览器真实渲染 + 拦截 API 的隔离响应，未访问云端数据库',
    screenshots: out,
  }
  fs.writeFileSync(out + '/report.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
})().catch(async (e) => {
  console.error(e)
  if (runningBrowser) await runningBrowser.close()
  process.exitCode = 1
})
