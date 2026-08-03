# Action Spotting与SoccerNet

---

## 1. 任务定义

Action Spotting（事件定位）是在长视频中检测特定事件的发生时刻，输出事件类别和时间戳。与Temporal Action Localization（TAL）不同，Action Spotting的事件通常是瞬间的（单时间戳），而不是持续一段时间的时间段。

足球Action Spotting的典型事件：
- 射门 (Shot)
- 进球 (Goal)
- 红牌 (Red Card)
- 黄牌 (Yellow Card)
- 犯规 (Foul)
- 越位 (Offside)
- 角球 (Corner)
- 界外球 (Throw-in)
- 换人 (Substitution)

## 2. SoccerNet

SoccerNet是足球视频理解的基准数据集和评测平台，涵盖多个任务：

| 任务 | 说明 | 指标 |
|------|------|------|
| Action Spotting | 检测17类事件 | Average-mAP |
| Ball Action Spotting | 检测球相关动作 | mAP |
| Tracking | 球员/球/裁判追踪 | MOTA |
| Calibration | 球场校准 | IoU |
| Re-identification | 球员ReID | mAP |
| Captioning | 视频描述 | BLEU/METEOR |

### SoccerNet Action Spotting

- 数据：550场英超比赛（完整广播视频）
- 标注：17类事件，单时间戳
- 评价指标：Average-mAP（不同容忍度窗口下的mAP均值）
- 挑战：长视频（45分钟半场），稀疏事件（一场约50-150个事件）

### SoccerNet Ball Action Spotting

- 2024/2025新增任务
- 更细粒度的球相关动作
- 类别：Pass、High Pass、Cross、Shot、Header、Drive、Throw-in、Free Kick、Tackle
- 标注包含：事件类别 + 时间戳 + 执行球队

## 3. 为什么Action Spotting困难

- 长视频处理：45分钟半场，每秒25-50帧
- 稀疏事件：几分钟才出现一个事件
- 事件定义模糊：裁判吹哨到事件发生的"时刻"如何定义？
- 类间相似：Pass和Cross的区别有时很细微
- 场景偏差：进球庆祝可能比进球本身更容易被模型识别
- 多尺度时间依赖：射门需要局部上下文，红牌需要更长时间的累积信息

## 4. 基本框架

### 4.1 传统框架

```
完整视频
    ↓
特征提取 (ResNet / I3D / SlowFast)
    ↓
时间窗口滑动分类
    ↓
NMS
    ↓
事件时间点
```

### 4.2 现代框架 (SOTA)

```
完整视频
    ↓
特征提取 (CLIP / DINOv3 / VideoMAE)
    ↓
时序特征序列 (T × D)
    ↓
时序建模网络 (T-DEED / MS-TCN / Transformer)
    ↓
逐帧预测
  ├── 事件分类 (C类)
  └── 时间偏移预测 (offset)
    ↓
置信度过滤 + 时间NMS
    ↓
事件时间点
```

## 5. 特征提取

### 5.1 视频特征

| 特征 | 特点 | 在SoccerNet中的表现 |
|------|------|--------------------|
| ResNet-152 | 2D CNN，逐帧提取 | 基线效果，忽略时间 |
| I3D | 3D CNN，短时窗 | 中等，计算量大 |
| SlowFast | 双路径，时间分辨率不同 | 好但慢 |
| VideoMAE | Video Transformer，MAE预训练 | 非常好，但计算量大 |
| CLIP | 图文预训练，通用特征 | 好，迁移性强 |
| DINOv2/v3 | 自监督视觉基础模型 | 目前SOTA特征 |
| SoccerCLIP | 足球领域CLIP | 领域特化，潜力大 |

### 5.2 辅助特征

- 音频特征：哨声、欢呼、解说语气
- OCR特征：比分牌时间戳、进球回放标志
- 轨迹特征：球/球员轨迹变化
- 镜头特征：镜头切换频率、回放标志

## 6. 时序建模

### 6.1 MS-TCN (Multi-Stage Temporal Convolutional Network)
- 多阶段1D时序卷积
- 每阶段由膨胀卷积层组成
- 阶段之间用残差连接
- 适合密集预测任务

### 6.2 Transformer Encoder
- 自注意力建模长距离时间依赖
- 位置编码保留时间顺序
- 可以处理可变长度输入

### 6.3 T-DEED
专门为事件定位设计的Encoder-Decoder架构（详见第11章）。

## 7. 后处理

### 7.1 置信度过滤
- 保留预测概率 > 阈值的事件
- 不同类别可以设置不同阈值

### 7.2 时间NMS
- 与空间NMS类似，但在时间维度
- 移除同一事件附近（<容忍窗口）的重复检测

### 7.3 结果校准
- 仅保留每段连续预测中置信度最高的一个
- 或使用分类头预测的偏移量精确调整时间戳

## 8. 评估指标

### Average-mAP

SoccerNet Action Spotting的官方指标：

```
对于每个容忍度 δ ∈ {1, 2, 5, 10, 15, 20, 25}秒:
    如果 |pred_time - gt_time| < δ:
        认为是TP
    否则:
        认为是FP
    计算该δ下的mAP

最终 = 所有δ的mAP均值
```

这个指标的设计思想：事件定位允许一定的时间误差，容忍度越小评估越严格。

## 9. 基线方法

| 方法 | 特征 | mAP (avg) |
|------|------|-----------|
| Baseline (ResNet + TCN) | ResNet-152 | ~40% |
| E2E-Spot | SlowFast | ~50% |
| T-DEED | CLIP / DINOv2 | ~58% |
| T-DEED + dude.k | DINOv2 | ~62% |
| SOTA (2024) | VideoMAE + 特化架构 | ~67% |

## 10. 在足球任务中的适用性

- Action Spotting直接服务于足球视频分析的核心需求
- 比赛摘要生成、战术分析、自动集锦的基础
- 和足球追踪系统可以协同工作：
  - 追踪提供球的轨迹 → 辅助判断球动作类型
  - 事件检测提供时间戳 → 辅助截取分析片段

## 11. 工程实现难点

### 11.1 长视频GPU显存管理
- 45分钟视频特征序列长度巨大（~67500帧@25fps）
- 无法一次性放入GPU，需要滑动窗口或梯度累积
- 特征预提取 + 缓存到磁盘是常见方案

### 11.2 特征存储
- 单场比赛视频特征可能占用数GB存储
- 不同模型的特征无法共享，实验管理复杂
- 特征提取速度可能慢于实际模型训练

### 11.3 时间容忍度选择
- 不同事件的时间精度要求不同（换人宽容忍，射门严格）
- 单一指标难以全面反映模型能力
- 实际应用中需要根据不同事件类型调整容忍度

### 11.4 类别不平衡
- 常见事件（Pass）和稀有事件（Red Card）数量差距悬殊
- 需要过采样/重采样策略
- 稀有事件的评估可靠性低

### 11.5 比赛多样性
- 不同比赛、联赛的风格差异大
- 转播风格影响（镜头剪辑频率、回放习惯）
- 跨域泛化是实际部署的重要问题

## 12. 可以继续改进的方向

- 多模态融合（视觉+音频+轨迹+OCR）
- 视频级上下文建模（不只是clip级）
- 事件间关系建模（黄牌→红牌的因果推理）
- 弱监督/自监督减少标注依赖
- 实时Action Spotting（比赛直播场景）

## 13. 参考资料

- SoccerNet: https://www.soccer-net.org/
- Giancola et al., SoccerNet: A Scalable Dataset for Action Spotting in Soccer Videos, CVPR 2018
- Cioppa et al., SoccerNet-v2: A Dataset and Benchmarks for Holistic Understanding of Broadcast Soccer Videos, CVPR 2021
- Deliege et al., SoccerNet-v3: A Scalable Dataset for Action Spotting in Soccer Videos, 2021
- Cioppa et al., ARFEN: Action Spotting in Soccer Videos, arXiv 2022
- Giancola et al., The SoccerNet Benchmarking Suite, 2023
