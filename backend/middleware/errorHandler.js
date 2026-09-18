// 统一错误处理（轻量工程化，沿用讲义第 2 课「进阶技巧」的做法）

const { createResponse } = require('../utils/response');

// 404：没有任何路由匹配时触发，交给下面的 errorHandler 统一输出
function notFound(req, res, next) {
  next({ status: 404, message: `接口不存在：${req.method} ${req.originalUrl}` });
}

// 统一异常出口，必须挂在所有路由之后
function errorHandler(err, req, res, next) {
  const message = err.message || '服务器内部错误';

  // 数据库未连接时，返回可读提示，而不是晦涩的 Mongoose 原生报错
  const isDbError =
    err.name === 'MongooseError' ||
    err.name === 'MongoNotConnectedError' ||
    /buffering timed out|must be connected|not connected/i.test(message);

  if (isDbError) {
    return res
      .status(503)
      .json(
        createResponse(
          false,
          null,
          '数据库未连接，请检查 .env 中的 MONGO_URI 是否正确',
          err.message
        )
      );
  }

  const status = err.status || 500;

  // 开发环境打印堆栈，便于定位问题
  if (process.env.NODE_ENV !== 'production') {
    console.error('[错误]', err);
  }

  res.status(status).json(createResponse(false, null, message, err.message || null));
}

module.exports = errorHandler;
module.exports.notFound = notFound;
