// 统一错误处理（轻量工程化，沿用讲义第 2 课「进阶技巧」的做法）

const { createResponse } = require('../utils/response');

// 404：没有任何路由匹配时触发，交给下面的 errorHandler 统一输出
function notFound(req, res, next) {
  next({
    status: 404,
    message: `接口不存在：${req.method} ${req.originalUrl}`,
  });
}

// 统一异常出口，必须挂在所有路由之后
function errorHandler(err, req, res, next) {
  const message = err.message || '服务器内部错误';

  // 不把 CloudBase SDK 的底层请求对象或凭据细节返回给调用方。
  const isDbError =
    err.name === 'CloudBaseConfigurationError' ||
    err.name === 'CloudBaseDatabaseError';

  if (isDbError) {
    return res
      .status(503)
      .json(
        createResponse(
          false,
          null,
          err.collectionName === 'feynman_attempts'
            ? '复述数据库暂不可用，请确认 feynman_attempts 集合已创建并检查后端数据库配置'
            : err.collectionName === 'feynman_quizzes'
              ? '测评数据库暂不可用，请确认 feynman_quizzes 集合已创建并检查后端数据库配置'
              : 'CloudBase 数据库暂不可用，请检查环境 ID、服务端 API Key 和数据库集合配置',
          err.code || err.requestId || 'CLOUDBASE_UNAVAILABLE',
        ),
      );
  }

  const status = err.status || 500;

  // 开发环境打印堆栈，便于定位问题
  if (process.env.NODE_ENV !== 'production') {
    console.error('[错误]', err.name, err.message);
  }

  res
    .status(status)
    .json(createResponse(false, null, message, err.message || null));
}

module.exports = errorHandler;
module.exports.notFound = notFound;
