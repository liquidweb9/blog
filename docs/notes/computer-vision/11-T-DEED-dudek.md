# T-DEED与dude.k

## 1. 模型定位

### T-DEED
T-DEED（Temporal Discriminability Enhanced Encoder-Decoder）是专门为事件定位（Action Spotting）设计的时序模型，解决两个核心问题：
1. 相邻时间帧的特征"可区分性不足"——普通时序模型使特征趋于平滑，难以分辨事件边界
2. 输出时间分辨率不够精细——在降采样的低分辨率特征上做分类，时间戳精度受限于采样间隔

### dude.k
dude.k 不是一个新的理论模型，而是基于 T-DEED 的 SoccerNet Ball Action Spotting 挑战赛工程框架。它对 T-DEED 进行重新实现和改进，提供完整的数据读取、训练、评估和推理流程。

```
两者的关系:

T-DEED
  → 论文: 提出 Encoder-Decoder + TDE 模块 + offset 回归
  → 数据集: SoccerNet Action Spotting (17类比赛事件)
  → 特征: CLIP / DINOv2

dude.k
  → 工程: T-DEED 的重新实现和改进
  → 数据集: SoccerNet Ball Action Spotting (9类球动作)
  → 特征: DINOv2
  → 增加: 球队联合预测、Ball Action 专用数据处理、评估
```

## 2. 为什么提出 T-DEED

现有方法的不足：

```
MS-TCN (Multi-Stage Temporal Convolutional Network):
  问题1: 纯卷积 → 感受野受限于核大小 × 膨胀率 × 层数
  问题2: 输出分辨率 = 输入分辨率 (没有上采样)
  问题3: 没有时间判别性增强 → 相近帧的特征几乎一样

Transformer Encoder:
  问题1: 自注意力使全局特征趋于一致 → 事件边界模糊
  问题2: 没有 Encoder-Decoder 架构，输出分辨率等于输入分辨率
  问题3: 没有显式的事件时间戳偏移学习

T-DEED 的针对性回答:
  问题1 → TDE 模块: 放大帧间差异，让事件边界更清晰
  问题2 → Decoder 上采样: 在更高时间分辨率上做预测
  问题3 → Offset 回归: 精确预测事件发生时刻相对于帧采样的偏移
```

## 3. 网络结构

### T-DEED 完整结构

```
视频特征序列 (T × D)
  T = 时间帧数 (降采样后，通常 ~2fps)
  D = 特征维度 (CLIP: 512, DINOv2: 768/1024)
     ↓
┌──────────────────────────────────────────┐
│           Temporal Encoder                │
│                                           │
│  1D Conv (k=3) + BN + ReLU               │
│  多尺度膨胀卷积 (dilation 1, 2, 4, 8)    │
│  + 自注意力层                             │
│                                           │
│  输出: 上下文增强的时序特征 (T × D_enc)    │
└───────────────────┬──────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│     TDE (Temporal Discriminability       │
│          Enhancement) 模块               │
│                                           │
│  1D Conv → 帧差计算 → 特征放大            │
│  或者: 对比学习增强相邻帧判别性           │
│                                           │
│  输出: 帧间差异放大的特征 (T × D_enc)     │
│        事件帧 → 响应增强                  │
│        非事件帧 → 响应抑制                 │
└───────────────────┬──────────────────────┘
                    ↓
┌──────────────────────────────────────────┐
│              Decoder                      │
│                                           │
│  上采样 (×2~×4) → 高时间分辨率            │
│  多尺度特征融合                           │
│  Skip connection from Encoder             │
│                                           │
│  输出: 高时间分辨率特征 (T' × D_dec)      │
│        T' > T, 时间精度提升              │
└───────────────────┬──────────────────────┘
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
┌─ 分类头 ──────┐           ┌─ 偏移头 ──────┐
│ Conv1D →      │           │ Conv1D →      │
│ C 类 (含背景)  │           │ 1 维 offset   │
│               │           │ 预测时间戳偏移  │
│ 输出: T' × C  │           │ 输出: T' × 1  │
└───────────────┘           └───────────────┘
    ↓                               ↓
类别概率 + Softmax          offset (秒/帧)
    │                               │
    └───────────────┬───────────────┘
                    ↓
              ┌──────────┐
              │  后处理   │
              │ 阈值过滤  │
              │ 时间NMS   │
              │ 偏移校准  │
              └─────┬────┘
                    ↓
          最终事件时间点列表
```

### dude.k 的改动

```
视频特征序列 (T × D) — DINOv2
     ↓
T-DEED Encoder-Decoder (改进版)
  └── 效率/精度优化
     ↓
联合分类头
  ├── 动作类别分支 (9类 + 背景)
  └── 球队预测分支 (2类: left/right)
     ↓
后处理
  ├── 置信度过滤
  ├── 时间NMS
  └── 球队信息附加
     ↓
事件时间点 + 类别 + 执行球队
```

## 4. 核心模块详解

### 4.1 TDE 模块（时间判别性增强）

这是 T-DEED 最核心的创新。问题背景：

```
普通时序模型的效果:
  原始特征: [0.1, 0.12, 0.9, 0.85, 0.15, 0.13]
            ↑── 平滑 ──↑   ↑事件发生↑  ↑── 平滑 ──↑
  事件边界: 不清晰 (0.12→0.9 是模糊过渡还是突变？)

TDE 模块后的效果:
  强化特征: [0.05, 0.08, 0.95, 0.9, 0.1, 0.08]
             ↑── 更平滑 ──↑ ↑剧烈突变↑ ↑── 更平滑 ──↑
  事件边界: 非常清晰 (0.08→0.95 是明确的突变)
```

TDE 的实现思路：
- 计算帧间特征差分 → 差分大的地方就是变化发生的地方
- 用可学习的缩放因子 α 放大这些差异
- 差分小的背景帧被进一步压缩，事件帧被进一步放大
- 本质上是一个"对比度增强"操作，但作用在时间特征上而非图像像素上

### 4.2 Decoder 上采样

传统方法在降采样的低时间分辨率特征上直接分类：

```
输入帧率 25fps → 特征提取 → 降采样到 2fps
→ 时间精度 = 0.5秒 ← 这对于事件定位太粗糙了

T-DEED 的 Decoder:
  输入: T × D (2fps, 精度 0.5s)
  上采样 ×2~×4
  输出: T' × D_dec (4-8fps, 精度 0.125-0.25s)
  → 配合 offset 回归 → 亚帧精度定位
```

### 4.3 Offset 回归

事件不一定精确地发生在特征帧采样的那一刻。例如一个射门事件——事件标注在 12.3 秒，但特征帧采样在 12.0 秒和 12.5 秒。模型在 12.5 秒的帧上分类为"射门"类，但实际时间戳应该是 12.3 秒。

Offset 回归让模型预测：事件发生时刻相对于当前特征帧的时间偏移量。

```
帧采样:     [12.0s]        [12.5s]        [13.0s]
            ↑ 背景          ↑ 分类=射门     ↑ 背景
                              offset = -0.2s
                              
最终时间戳: 12.5 + (-0.2) = 12.3s ← 精确时间戳
```

## 5. 损失函数

### T-DEED 损失

```
总损失 = λ₁ × L_classification + λ₂ × L_offset + λ₃ × L_background

① 分类损失: Focal Loss
   L_cls = -αₜ(1 - pₜ)^γ · log(pₜ)
   
   αₜ: 平衡正负样本 (背景帧 >> 事件帧)
   γ: 聚焦难分样本 (γ=2 是常用值)
   
   为什么用 Focal Loss?
   → 一场比赛 67,500 帧 (25fps)，事件 50-150 个
   → 正样本率 < 0.2%，负样本完全主导梯度
   → Focal Loss 自动降低 easy negatives 的权重

② 偏移损失: L1 Loss (Masked)
   L_offset = Σₜ has_event[t] × |pred_offset[t] - gt_offset[t]|
   
   关键: 只有事件位置参与计算
   has_event[t] = 1 如果帧 t 对应的事件窗口内
   has_event[t] = 0 否则

③ 背景/无事件损失: Cross Entropy
   帮助模型区分"事件"和"无事件"
```

### dude.k 额外损失

```
附加: 球队分类损失

L_team = CE(pred_team, gt_team)

只有球动作事件帧参与计算:
  has_action[t] = 1 → 计算球队损失
  has_action[t] = 0 → 忽略

总损失 = T-DEED 损失 + λ × L_team
```

## 6. 训练流程

```
标准训练流程:

1. 特征预提取
   └── 对整个视频使用 CLIP/DINOv2 提取所有帧的特征
   └── 降采样到 ~2fps (减少冗余，降低序列长度)

2. 标签准备
   └── 将事件时间戳映射到降采样后的特征帧索引
   └── 为每个特征帧计算: 是否有事件？什么类别？offset 多少？

3. 滑动窗口采样
   └── 从长视频特征序列中随机抽取窗口 (如 128-256 帧)
   └── 窗口间可能有重叠
   └── 确保窗口包含足够的事件样本

4. 训练循环
   └── Batch → Encoder-Decoder → 分类 + Offset 预测
   └── Focal Loss + L1 Loss + (可选 Team Loss)
   └── Cosine LR + AdamW
   └── 验证集监控 Average-mAP

5. 推断流程
   └── 滑动窗口覆盖全视频 → 逐段预测
   └── 背景类过滤 (保留非背景预测)
   └── 置信度阈值过滤
   └── 时间 NMS (移除同一事件附近的重复检测)
   └── 时间戳 = 帧索引 × 帧间隔 + offset
   └── 输出事件列表
```

### 关键工程细节

| 环节 | 细节 | 重要性 |
|------|------|--------|
| 特征降采样率 | 2-3fps 足够捕获事件（事件持续 >0.5s） | 高：太密冗余，太稀丢失信息 |
| 窗口长度 | 128-256 帧特征 (~64-128s) | 高：太短丢失上下文，太长显存超标 |
| 时间标签构造 | 事件映射到最近的特征帧 + 计算 offset | 关键：Label 错误直接损害模型 |
| 背景类设计 | 需要单独的"无事件"类 vs 用低置信度表示 | 中：影响 Focal Loss 的行为 |
| 验证集类别平衡 | 确保每类事件在验证集中都有全部分 | 中：稀有事件的评估需要足够样本 |

## 7. 优缺点

### T-DEED

| 优点 | 缺点 |
|------|------|
| 时间定位精度高 (上采样 + offset 回归) | 依赖预提取特征，端到端训练困难 |
| TDE 模块独特地增强了帧间判别性 | 特征提取耗时（数小时/比赛） |
| 多尺度适应不同持续时间的事件 | 长序列全建模能力受窗口大小限制 |
| 可与不同视觉特征（CLIP/DINOv2）组合 | 稀有事件（红牌/点球）效果差 |
| Encoder-Decoder 架构输出高时间分辨率 | 窗口边界的事件可能被遗漏 |

### dude.k

| 优点 | 缺点 |
|------|------|
| 完整工程框架，可复现竞赛结果 | 不是独立的模型创新 |
| 球队联合预测提升球动作检测 | 对 T-DEED 本身的改进有限 |
| Ball Action 专用数据处理 | 特征预提取和存储是工程瓶颈 |
| 训练和评估流程完善 | 跨比赛、跨联赛泛化待验证 |

### 与其他方法的对比

| 方法 | 输出方式 | 时间精度 | 端到端 | 多尺度 |
|------|---------|---------|--------|--------|
| MS-TCN | 分类 (网格) | 低（依赖采样率） | 是 | 中（膨胀卷积） |
| Transformer | 分类 (序列) | 低（无上采样） | 是 | 无（或有限） |
| T-DEED | 分类+Offset | 高（上采样+偏移） | 否（特征预提取） | 是 (Decoder) |
| ActionFormer | 分类+回归+IoU | 高 | 是 | 是 |

## 8. 在足球任务中的适用性

### 适用的事件类型

| 事件类别 | T-DEED 适合度 | 原因 |
|---------|-------------|------|
| 射门 (Shot) | ★★★★★ | 局部动作特征明显，球速/轨迹变化大 |
| 传球 (Pass) | ★★★★☆ | 特征较微妙，但offset精准定位有价值 |
| 高球 (High Pass) | ★★★★☆ | 球有明显的高度变化，视觉特征可检测 |
| 头球 (Header) | ★★★★☆ | 球员跳跃 + 球方向突变 |
| 犯规 (Foul) | ★★★☆☆ | 需要长时间的上下文（冲突累积） |
| 红牌 (Red Card) | ★★☆☆☆ | 极度稀有，特征不足，依赖多模态 |
| 黄牌→红牌 | ★☆☆☆☆ | 需要事件因果关系建模（不是 T-DEED 能力范围） |

### 特征选择建议

- DINOv2 特征是当前 SOTA 选择（提供最强的通用视觉表征）
- 球轨迹特征作为辅助输入可以提升球相关动作的检测
- 音频特征（哨声、欢呼）作为额外模态可以改善比赛事件检测
- 建议：视觉特征 + 球轨迹 + 球员轨迹 + 音频 → 多模态 T-DEED

## 9. 工程实现难点

### 9.1 特征预提取与版本管理

| 难点 | 说明 | 缓解方案 |
|------|------|---------|
| 提取耗时 | DINOv2/ViT-L 提取一场比赛需要 10-30 GPU小时 | 多GPU并行，预提取后缓存 |
| 存储成本 | 单场特征 200-500MB，550场比赛 ~100-275GB | 使用高效的压缩格式（如 .npy/.npz） |
| 版本管理 | 不同特征版本（CLIP vs DINOv2 vs DINOv3）不可互换 | 文件名编码信息：`{video_id}_{model}_{version}.npy` |
| 时间对齐 | 特征帧率 vs 原始帧率 vs 事件标注时间 → 三套时间基准 | 统一转换为一个参考时间基准 |

### 9.2 时间对齐

```
三套时间基准的对齐:

原始视频帧 (25fps):
  帧 0   帧 1   帧 2   帧 3   帧 4   帧 5   帧 6   帧 7
  │             │             │             │
特征帧 (~2fps):  特征0         特征1         特征2
  │                   │             │
事件标注:           事件A@0.35s  事件B@1.2s

对齐:
  事件 A (0.35s) → 映射到特征帧 0 (0.0-0.5s 范围)
  事件 B (1.20s) → 映射到特征帧 1 (0.5-1.0s 范围) ← 精度损失!

  → 需要 offset 回归来修正
  → 事件 B 的 offset = 1.2 - 1.0 = +0.2s
```

### 9.3 窗口边界的漏检

- 滑动窗口在边界处可能截断事件（事件的上下文被窗口切断）
- 解决：窗口重叠 50%，边界帧的预测在重叠区域中被修正
- 但对于极长的事件（如长时间的控球）→ 单个 256 帧窗口可能不够

### 9.4 类别极度不平衡

- Pass 类（每场 100-300 次） vs Red Card 类（每场 <1 次）
- Focal Loss 的 α 和 γ 需要针对不平衡程度仔细调参
- 稀有类别的评估不可靠（验证集只有 2-3 个样本）
- 解决：类别加权采样 + 过采样稀有类 + 合成数据增强

### 9.5 后处理的敏感性

- 置信度阈值：调低 → 召回↑，精确率↓，NMS 负担↑
- 时间 NMS 窗口：调小 → 同一事件多个输出，调大 → 相邻事件合并
- Offest 校准的策略：直接加 offset vs 阈值判断后加 offset → 影响指标
- 后处理对最终 ScoreNet 指标影响极大（可达 5-10 个 mAP 点）

### 9.6 多比赛/多联赛泛化

- 不同比赛的拍摄风格差异大（镜头切换频率、慢动作比例）
- 不同联赛的足球风格不同（英超快节奏 vs 意甲战术性强）
- 训练集（英超）→ 测试集（其他联赛）→ 性能下降
- 需要在训练时增加域名 -> 比赛多样性

## 10. 当前项目中的实验结果（参考值）

| 方法 | 特征 | 数据集 | mAP |
|------|------|--------|-----|
| T-DEED | CLIP | Action Spotting (17类) | ~56% |
| T-DEED | DINOv2 | Action Spotting (17类) | ~58-60% |
| T-DEED | DINOv2 | Ball Action Spotting (9类) | ~50-55% |
| dude.k | DINOv2 | Ball Action Spotting (9类) | ~55-60% |
| SOTA (2024) | VideoMAE + 特化 | Action Spotting | ~67% |

- 时间偏移回归通常提高 2-3 个 mAP 点
- 多模态（+音频+轨迹）可再提高 3-5 个点
- 后处理（阈值+NMS+校准）对最终指标的影响可达 5-10 个点

## 11. 失败案例

- 快速连续事件（2秒内连续两次传球）→ 时间 NMS 可能合并为一个事件
- 远镜头微动作（轻微触球）→ 无法从 DINOv2 特征中可靠区分
- 稀有事件过拟合和欠拟合并存 → 训练集中数量不足以学习稳健模式
- 事件的时间依赖（黄牌后裁判掏口袋 → 可能是红牌）→ 纯分类模型无法利用这种依赖
- 半场/比赛结束时的事件 → 窗口可能不够长覆盖事件上下文

## 12. 可以继续改进的方向

- 结合足球追踪轨迹：球速突变、方向变化 → 辅助球动作分类
- 时间关系建模：事件之间的因果依赖（黄牌 → 红牌链）
- 多任务联合学习：同时检测球动作 + 比赛事件 + 球队归属
- 多模态输入：视觉 + 轨迹 + 音频 → 提升所有事件类型的检测
- 端到端训练：替代特征预提取，直接从视频帧输入
- 长视频全局上下文：不只是 clip 级别，而是整场比赛的全局建模
- 弱监督/主动学习：减少对大型标注数据集的依赖

## 13. 重要代码片段

```python
# TDE 模块 - 时间判别性增强
class TDEModule(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.conv = nn.Conv1d(dim, dim, kernel_size=3, padding=1)
        self.alpha = nn.Parameter(torch.tensor(1.0))  # 可学习的放大因子

    def forward(self, x):
        # x: (B, C, T)
        residual = x
        x = self.conv(x)
        # 计算帧间差分并放大
        diff = x[:, :, 1:] - x[:, :, :-1]
        diff = F.pad(diff, (1, 0), mode='replicate')
        x = residual + self.alpha * diff
        return x

# Decoder 上采样
class TimeDecoder(nn.Module):
    def __init__(self, in_dim, out_dim, upsample_factor=2):
        super().__init__()
        self.upsample = nn.Upsample(
            scale_factor=upsample_factor, 
            mode='linear', 
            align_corners=False
        )
        self.conv = nn.Conv1d(in_dim, out_dim, kernel_size=3, padding=1)

    def forward(self, x):
        # x: (B, C, T)
        x = self.upsample(x)  # (B, C, T × upsample_factor)
        x = self.conv(x)
        return x

# Focal Loss (简化实现)
class FocalLoss(nn.Module):
    def __init__(self, alpha=0.25, gamma=2.0):
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma

    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = self.alpha * (1 - pt) ** self.gamma * ce_loss
        return focal_loss.mean()

# Masked Offset L1 Loss
def offset_loss(pred_offset, gt_offset, has_event_mask):
    """
    pred_offset: (B, T, 1) - 预测的偏移量
    gt_offset: (B, T, 1) - 真实的偏移量
    has_event_mask: (B, T) - 哪些帧有事件
    """
    loss = F.l1_loss(pred_offset, gt_offset, reduction='none')
    # 只计算事件帧的损失
    loss = loss.squeeze(-1) * has_event_mask.float()
    return loss.sum() / (has_event_mask.sum() + 1e-8)
```

## 14. 参考资料

- T-DEED: Precise Event Spotting via Temporal Discriminability Enhancement, 2024
- dude.k: SoccerNet Ball Action Spotting Challenge 框架, 2024/2025
- Giancola et al., SoccerNet: A Scalable Dataset for Action Spotting in Soccer Videos, CVPR 2018
- Cioppa et al., SoccerNet-v2: A Dataset and Benchmarks for Holistic Understanding of Broadcast Soccer Videos, CVPR 2021
- Deliege et al., SoccerNet-v3: A Scalable Dataset for Action Spotting in Soccer Videos, 2021
- Cioppa et al., ARFEN: Action Spotting in Soccer Videos, arXiv 2022
- Lin et al., Focal Loss for Dense Object Detection, ICCV 2017
