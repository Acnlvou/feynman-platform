// 知识点模型（对应讲义第 3 课）
// 讲义注释里写了 status 的三个枚举值，但代码没加 enum 约束，这里补上（见 errata.md）

const mongoose = require('mongoose');

const knowledgePointSchema = new mongoose.Schema(
  {
    // 所属用户，用于实现「只能操作自己的知识点」
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, '标题不能为空'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, '内容不能为空'],
    },
    // 掌握状态：未开始 / 学习中 / 已掌握
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'mastered'],
      default: 'not_started',
    },
    // 是否加入复习计划
    reviewList: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('KnowledgePoint', knowledgePointSchema);
