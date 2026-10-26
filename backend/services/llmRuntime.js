// 本进程内所有AI业务共享并发与待补存结果容量。
const active = new Set();
const pending = new Map();
function acquire(user) {
  if (active.has(user) || active.size >= 4)
    throw Object.assign(new Error('AI任务正忙，请等待当前任务完成'), {
      status: 429,
    });
  active.add(user);
  let released = false;
  return () => {
    if (!released) active.delete(user);
    released = true;
  };
}
module.exports = { acquire, pending };
