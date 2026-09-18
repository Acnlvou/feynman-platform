// 用户模型（对应讲义第 2 课）
// 注意：讲义第 3 课的路由里误用了 name 字段，这里统一为 username（见 errata.md 第 1 条）

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, '用户名不能为空'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, '邮箱不能为空'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, '密码不能为空'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
