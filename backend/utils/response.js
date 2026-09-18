// 统一响应格式（沿用讲义第 2 课「进阶技巧」里的写法）
// 成功：{ success: true,  data,        message, error: null }
// 失败：{ success: false, data: null,  message, error }

function createResponse(success, data = null, message = '', error = null) {
  return { success, data, message, error };
}

module.exports = { createResponse };
