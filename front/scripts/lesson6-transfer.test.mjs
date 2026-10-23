import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseImport,
  backup,
  importBatches,
} from '../src/utils/knowledgeTransfer.js'
const note = {
  title: '公式与图表',
  content: '# 内容\n\n$E=mc^2$\n\n```mermaid\ngraph LR\nA-->B\n```',
  status: 'in_progress',
  reviewList: true,
  category: '数学',
  tags: ['公式', '图表'],
}
test('JSON 备份精确保留正文与分类标签，只携带可迁移字段', () => {
  const exported = backup([
    {
      ...note,
      _id: 'private-id',
      user: 'private-user',
      history: [{}],
      revision: 8,
    },
  ])
  assert.deepEqual(parseImport(JSON.stringify(exported), 'backup.json'), [note])
  assert.equal(exported.knowledgePoints[0].history, undefined)
  assert.equal(exported.knowledgePoints[0].user, undefined)
})
test('Markdown 标题与多行代码块不被损坏，支持BOM和文件名标题', () => {
  assert.equal(
    parseImport('\uFEFF# 标题\r\n\r\n' + note.content, '笔记.md')[0].content,
    note.content,
  )
  assert.equal(parseImport(note.content, '普通.md')[0].title, '内容')
  assert.equal(parseImport('只有正文', '文件名.markdown')[0].title, '文件名')
})
test('拒绝非法JSON、未知备份版本、错误字段及空文件', () => {
  for (const [text, name] of [
    ['{', 'a.json'],
    [JSON.stringify({ ...backup([note]), version: 2 }), 'b.json'],
    ['', 'empty.md'],
    [JSON.stringify(backup([{ ...note, tags: [{}] }])), 'c.json'],
  ])
    assert.throws(() => parseImport(text, name))
})
test('大备份按30条及字节数分批，每条原对象只出现一次', () => {
  const points = Array.from({ length: 80 }, (_, i) => ({
    ...note,
    title: '记录' + i,
    content: '汉'.repeat(20000),
    importKey: 'key-' + i,
  }))
  const batches = importBatches(points)
  assert.deepEqual(batches.flat(), points)
  assert.ok(
    batches.every(
      (batch) =>
        batch.length <= 30 &&
        new TextEncoder().encode(JSON.stringify(backup(batch))).length <
          1000000,
    ),
  )
})
