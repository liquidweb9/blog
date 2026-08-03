# 目标检测基础

---

## 1. 任务定义

目标检测是计算机视觉中"定位+分类"的双重任务：给定一张图像，需要找出图中所有感兴趣物体的精确位置（用矩形包围框表示）和各自的类别标签。与图像分类（只输出"图里有什么"）不同，目标检测需要同时回答"物体是什么"和"物体在哪里"两个问题，这使得它在工程上比分类复杂得多。

包围框（Bounding Box）通常有两种表示方式：
- 中心坐标法：`(cx, cy, w, h)` — 中心点 + 宽度 + 高度
- 角点坐标法：`(x1, y1, x2, y2)` — 左上角 + 右下角

模型输出的原始检测结果通常数量庞大（每个特征图位置都有预测），需要经过两个关键后处理步骤：
- 置信度阈值过滤：仅保留分类置信度高于阈值的结果，过滤掉低质量预测
- NMS（非极大值抑制）：消除同一物体上的重复检测框

## 2. 基本概念与设计范式

### 2.1 IoU（交并比）

IoU 是目标检测中最基础的度量工具，计算预测框与真实框的重叠程度：

```
IoU = |A ∩ B| / |A ∪ B|
```

IoU 贯穿检测流程的几乎每一个环节：
- 训练中：判断 Anchor / Query 是否匹配到了真实物体（正负样本分配）
- 后处理中：NMS 判断哪些框代表同一个物体需要合并或抑制
- 评估中：作为 mAP 计算的基础（IoU ≥ 阈值才算正确检测）

阈值选择的典型经验：

| 阈值 | 含义 | 使用场景 |
|------|------|---------|
| IoU ≥ 0.5 | 宽松匹配 | mAP@0.5 评估，NMS 去重 |
| IoU ≥ 0.75 | 严格匹配 | mAP@0.75 评估 |
| IoU = 0.5~0.95 | COCO 标准 | 主流评估指标 |

### 2.2 Anchor-based vs Anchor-free

这是检测头设计的两种根本性分歧。

**Anchor-based**（Faster R-CNN、YOLOv3/v4/v5）：
- 在每个特征图位置预先定义一组固定大小和长宽比的"先验框"
- 先验框的数量和尺寸是超参数，通常通过对训练集 GT 框聚类（如 YOLO 的 AutoAnchor）获得
- 模型学习的是"相对于 Anchor 的偏移量"而不是绝对坐标
- 优点：引入了形状先验，对小目标和大物体的尺度差异更容易覆盖
- 缺点：超参数多，Anchor 设置对数据集敏感，训练时正负样本极度不平衡

**Anchor-free**（FCOS、YOLOX、YOLOv8+）：
- 不预定义任何先验框，直接从特征图位置预测到边界框四条边的距离
- 或预测关键点（中心点、左上右下角点）来推导框
- 近年来逐渐成为主流，因为消除了 Anchor 超参数的调优负担
- YOLO 系列从 v8 开始完全转向 Anchor-free

### 2.3 One-stage vs Two-stage

```
Two-stage 检测器:
  输入图像
     ↓
  Backbone (特征提取)
     ↓
  RPN (区域提议网络) → 生成候选区域 (Region Proposals)
     ↓
  ROI Pooling / ROI Align (候选区域特征提取)
     ↓
  分类头 + 回归头
     ↓
  检测结果

One-stage 检测器:
  输入图像
     ↓
  Backbone (特征提取)
     ↓
  Neck (特征融合)
     ↓
  密集分类 + 密集回归 (每个位置直接预测)
     ↓
  NMS
     ↓
  检测结果
```

| 维度 | Two-stage (Faster R-CNN) | One-stage (YOLO/FCOS) |
|------|-------------------------|----------------------|
| 流程 | 先提议后分类 | 一步到位 |
| 精度 | 历史上更高 | 差距在缩小 |
| 速度 | 较慢（~5-10 FPS） | 实时（30-100+ FPS） |
| 小目标 | RPN 对小目标召回好 | 依赖多尺度特征和输入分辨率 |
| 代表 | Faster R-CNN, Mask R-CNN | YOLO, SSD, RetinaNet, FCOS |

值得注意的趋势：RT-DETR 等 Transformer 检测器虽然也是"端到端"，但使用了 Query-based 的稀疏预测而非密集预测，从设计上消除了 NMS 的必要性。

### 2.4 NMS（非极大值抑制）

NMS 是检测后处理中消除重复检测的核心算法。

基本流程：
```
1. 将所有预测框按置信度降序排列
2. 选择置信度最高的框 A，加入最终结果
3. 移除所有与 A 的 IoU > 阈值的其他框
4. 重复步骤 2-3，直到所有框处理完毕
```

NMS 存在几个固有问题：
- 两个真实物体靠得很近时，NMS 可能错误地抑制其中一个（如篮球比赛中的球员）
- 对阈值敏感：太高（重复多），太低（漏检多）
- Soft-NMS 通过衰减替代硬移除来缓解第一个问题
- DIoU-NMS 在 IoU 基础上加入中心点距离约束，能更好地区分靠得很近的不同物体
- DETR 系列的集合预测方案从设计上消除了 NMS 的必要性，这是架构层面的根本性解决

## 3. 基本组件：Backbone、Neck、Head

现代检测模型普遍遵循 Backbone → Neck → Head 的三层结构，各组件可独立替换和优化。

```
输入图像 (H × W × 3)
     ↓
┌─────────────────┐
│    Backbone     │  ← 特征提取器 (ResNet / CSPDarknet / Swin / DINOv3)
│  (多尺度特征)    │
└────────┬────────┘
         ↓  P3, P4, P5, P6...
┌─────────────────┐
│     Neck        │  ← 特征融合层 (FPN / PAN / BiFPN / Hybrid Encoder)
│  (增强的多尺度   │
│   特征表示)      │
└────────┬────────┘
         ↓
┌─────────────────┐
│     Head        │  ← 任务特定预测 (Dense Prediction / Sparse Query)
│  ─────────────  │
│  分类分支        │
│  回归分支        │
│  Objectness     │
└────────┬────────┘
         ↓
    检测结果
```

### 3.1 Backbone 特征提取器

Backbone 负责从原始 RGB 图像中提取层次化的视觉特征，浅层特征包含丰富的空间细节（适合定位小目标），深层特征包含高度抽象的语义信息（适合分类）。

| Backbone | 类型 | 特点 |
|----------|------|------|
| ResNet | CNN + 残差连接 | 经典，训练稳定，使用广泛 |
| CSPDarknet53 | CNN + CSP 分割 | YOLOv5 专用，计算效率高 |
| EfficientNet | CNN + NAS 搜索 | 轻量，适合边缘设备 |
| Swin Transformer | ViT + 窗口注意力 | 全局感受野，高精度 |
| DINOv3 | 自监督 ViT | 通用视觉基础模型，可迁移性强 |

选择 Backbone 时的核心权衡：
- 精度 vs 推理速度 vs 参数量
- 部署设备对算子的支持情况（如某些 Transformer 算子在边缘设备上优化不足）
- 实际部署中常使用轻量版本（MobileNet、EfficientNet-lite）替代重型 Backbone

### 3.2 Neck 特征融合层

Neck 连接 Backbone 和 Head，负责融合不同尺度的特征。如果没有 Neck，浅层的精确位置信息和深层的丰富语义信息各自孤立，小目标检测（依赖浅层空间细节）和大目标分类（依赖深层语义）无法兼得。

| Neck 结构 | 核心机制 | 特点 |
|-----------|---------|------|
| FPN | 自顶向下路径 | 将深层语义传递到浅层 |
| PAN | FPN + 自底向上路径 | 浅层定位信息也能上传到深层 |
| BiFPN | 可学习加权融合 | 网络自主决定不同层的重要性 |
| Hybrid Encoder | CNN + Intra-scale Attention | RT-DETR 专用，多尺度高效编码 |

### 3.3 Head 检测头

Head 将 Neck 输出的特征映射为最终的检测结果，分为两种范式：

- **密集预测头（Dense Prediction）**：在特征图的每个空间位置都做出预测，适用于 YOLO 和 FCOS 这类需要全图覆盖的模型。优点是天然的网格先验适合小目标和密集场景，缺点是需要 NMS 后处理。
- **稀疏查询头（Sparse Prediction）**：使用可学习的 Object Queries 从特征中"读取"物体信息，这是 DETR 系列的标记性设计。优点是不需要 NMS、结构简洁，缺点是密集场景中需要足够多的 Query 数量。

## 4. 损失函数

损失函数是训练的指挥棒，直接影响优化行为和最终性能。现代检测器的损失通常由三部分组成。

### 4.1 分类损失

| 损失函数 | 适用场景 | 核心思想 |
|---------|---------|---------|
| Cross Entropy (CE) | 通用 | 标准的分类损失 |
| Focal Loss | 类别不平衡 | 降低 easy 样本权重，聚焦 hard 样本 |
| Varifocal Loss (VFL) | 现代 SOTA | 将 IoU 分数融入分类目标，让分类与定位对齐 |
| BCEWithLogitsLoss | YOLO 系列传统 | 数值稳定的二分类交叉熵 |

Focal Loss 的重要性在于解决了 One-stage 检测器最核心的问题：大部分特征图位置都是背景（easy negatives），其海量的小梯度更新淹没了少数正样本的梯度信号。Focal Loss 通过 `(1 - p_t)^γ` 的调制因子让模型把训练重点放在难分类样本上。

VFL 在此基础上进一步改进：它不仅关心"这个框是不是目标"，还关心"这个框的位置有多准"，将定位质量（IoU）也编码进分类目标中。这使得分类分数本身就是对框质量的综合评分，是目前 SOTA 检测器的首选分类损失。

### 4.2 回归损失（边界框损失）

| 损失函数 | 出处 | 核心思想 | 收敛速度 | 精度 |
|---------|------|---------|---------|------|
| Smooth L1 | Faster R-CNN | 对离群点不敏感 | 慢 | 中 |
| IoU Loss | UnitBox | 直接优化重叠面积 | 中 | 好 |
| GIoU Loss | CVPR19 | IoU=0 时仍提供有效梯度 | 中 | 好 |
| DIoU Loss | AAAI20 | 加入中心点距离约束 | 快 | 很好 |
| CIoU Loss | AAAI20 | 加入长宽比一致性约束 | 快 | 很好 |
| DFL | GFL (NeurIPS20) | 将连续坐标建模为离散分布 | 中 | 好 |

IoU 类损失优于 L1/L2 距离损失的关键原因：IoU 直接优化的是检测任务的本质目标（重叠度），而不是像素级的坐标逼近。当 GT 框很大时，L2 距离对框的偏移惩罚更重——这与直觉不符，而 IoU 是尺度不变的。

CIoU = IoU Loss + 中心点距离惩罚 + 长宽比一致性惩罚，是目前 YOLO 系列最常用的回归损失。DFL（Distribution Focal Loss）将框坐标建模为离散的 categorical distribution，通过聚焦于真值附近的位置来获得更精细的定位。

### 4.3 Objectness 损失

- YOLO v1-v7 有独立的 Objectness 分支，判断特征图位置是否包含物体的中心点
- DETR 系列用"无物体（no object）"类替代了这个概念
- YOLOv8/v11 中取消了独立的 Objectness 分支，改为更精细的标签分配策略（TaskAlignedAssigner）隐式处理

## 5. 评估指标

目标检测的评估比分类复杂，因为需要同时评价分类正确性和定位精度。

### 5.1 PR 曲线与 AP
```
Precision = TP / (TP + FP)    — 预测为正的结果中有多少是对的
Recall    = TP / (TP + FN)    — 真实目标中有多少被检测出来
```

- 改变置信度阈值：降低阈值 → Recall ↑，Precision ↓（存在 trade-off）
- AP（Average Precision）：PR 曲线下的面积，综合反映了不同置信度阈值下的表现
- mAP（mean Average Precision）：对所有类别的 AP 求均值，是检测任务的核心指标

### 5.2 COCO 评估标准

COCO 数据集使用多 IoU 阈值的平均 mAP，比单一 mAP@0.5 更严格：

| 指标 | 含义 | IoU 阈值 |
|------|------|---------|
| AP@0.5:0.95 | 主指标 | 0.5 到 0.95 步进 0.05 |
| AP@0.5 | 宽松匹配 | ≥ 0.5 |
| AP@0.75 | 严格匹配 | ≥ 0.75 |
| AP_small | 小目标 | 面积 < 32² |
| AP_medium | 中目标 | 32² ≤ 面积 < 96² |
| AP_large | 大目标 | 面积 ≥ 96² |

### 5.3 推理速度
- FPS（Frames Per Second）：每秒处理多少帧
- 与精度存在 trade-off，需要根据部署场景选择平衡点
- T4、A10、A100 等不同 GPU 上的 FPS 差异大，需要指定硬件环境

## 6. 数据增强与训练策略

### 6.1 常用数据增强

| 增强方法 | 原理 | 适用场景 |
|---------|------|---------|
| Mosaic (马赛克增强) | 四张图拼成一张，随机缩放拼接 | 增加小目标样本和背景多样性 |
| MixUp | 两张图按 α 比例混合像素和标签 | 提升泛化、减少过拟合 |
| Copy-Paste | 将目标实例从一个图像复制到另一个 | 增加罕见类别的样本数 |
| RandomAffine | 随机仿射变换（旋转、平移、缩放、剪切） | 模拟不同视角 |
| HSV 颜色抖动 | 随机改变色调、饱和度、亮度 | 模拟不同光照 |
| 运动模糊 | 对图像施加方向性模糊 | 模拟高速运动场景 |

Mosaic 增强在 YOLOv5 中被证明是提升小目标检测效果的关键技术之一。训练后期（如最后 10 个 epoch）通常关闭 Mosaic，因为拼接伪影会影响模型对真实场景的适应。

### 6.2 训练策略

```
训练流程概览：
  ┌─ 预训练权重加载（通常使用 COCO 预训练）
  ├─ 学习率 Warmup（前 3 epoch 逐步升温，防止初始不稳定）
  ├─ 多尺度训练（每个 batch 随机选择输入尺寸）
  ├─ Mosaic + MixUp 等数据增强
  ├─ Cosine / Step 学习率衰减
  ├─ EMA（指数滑动平均，保存参数的移动均值用于推理）
  └─ 早停（验证集 mAP 不再提升时停止）
```

## 7. 模型发展简史

```
目标检测模型演进路线:

Two-stage 时代 (2014-):
  R-CNN → Fast R-CNN → Faster R-CNN → Mask R-CNN
     │
     ├── 精度高，速度慢
     └── RPN 是核心创新

One-stage 时代 (2016-):
  YOLOv1 → YOLOv3 → YOLOv5 → YOLOv8 → YOLO11
  SSD → RetinaNet → FCOS → YOLOX
     │
     ├── 密集预测，实时性强
     └── Anchor-free 成为主流

Transformer 时代 (2020-):
  DETR → Deformable DETR → DINO → RT-DETR → RT-DETRv4
     │
     ├── Query-based 集合预测
     └── 消除 NMS，端到端

融合趋势 (2024-):
  CNN Backbone (EfficientNet/DINOv3)
     +
  Transformer Encoder-Decoder
     +
  Anchor-free 设计
```

值得注意的是，这三个时代并非线性替代，而是相互借鉴融合：
- RT-DETR 使用 CNN Backbone + Transformer Decoder
- YOLO 也在吸收注意力和 Anchor-free 的设计理念
- DINOv3 作为纯视觉 Backbone，可以接入任何一种检测架构

## 8. DINOv3视觉基础模型

DINOv3 不应与 YOLO、RT-DETR 并列为"检测器"。它的正确定位是：

```
DINOv3:
  → 自监督视觉基础模型（Self-supervised Vision Foundation Model）
  → 通过大规模自监督学习获得通用视觉表征
  → 提供高质量全局与稠密视觉特征
  → 下游可接入检测、分割、深度估计或检索模块
  → 部分实验场景下可作为 Teacher Model 蒸馏知识
```

与检测器的关系：
- DINOv3 → 替代 ResNet/CSPDarknet 作为 Backbone → 提供更强的特征 → 提升检测精度
- 这不是 DINOv3 "做检测"，而是 DINOv3 "提供特征给检测器用"

## 9. 可以继续改进的方向

- 时序信息辅助单帧检测：通过相邻帧特征融合或时序注意力机制减少单帧模糊和遮挡的影响
- 多视角融合检测：利用不同机位下的互补信息提升整体检测精度
- 极小目标检测：增加更细粒度的特征层、改进正负样本分配策略
- 自训练/弱监督方法：利用大量未标注数据扩充训练集，降低标注成本
- 模型压缩：知识蒸馏、剪枝、量化，将检测模型部署到边缘设备
- 检测与追踪的联合优化：端到端训练消除两个系统之间的信息损失

## 10. 工程实现难点

### 10.1 推理速度与精度平衡
- 高分辨率输入对极小目标检测至关重要（如 1280×1280），但会直接降低推理速度
- 多尺度 TTA 能提升精度但推理时间成倍增长
- 实际部署需要针对具体场景做 benchmark 来确定最优配置
- 不同 GPU 架构（T4、A10、A100）的推理行为可能存在细微差异

### 10.2 极小目标检测
- 极小目标在 Backbone 深层特征图中可能只剩 1-2 个像素，语义信息几乎完全丢失
- 增大输入尺寸是最直接但代价最大的方案
- 使用更高分辨率的特征图（减少降采样倍数）会增加 Neck 和 Head 的计算量
- 多尺度训练时小尺度图像上的小目标几乎消失，需要特殊策略保证训练效果

### 10.3 数据标注一致性
- 边界框定义标准不统一（按像素边缘 vs 按物体语义边缘）
- 遮挡物体的标注约定（标注可见部分 vs 估计完整框 vs 标记为不可见）直接影响模型行为
- 运动模糊帧的位置标注本身存在歧义
- 不同标注人员之间的风格差异需要建立质量控制流程管理

### 10.4 部署适配
- ONNX/TensorRT 导出时可能遇到算子兼容性问题
- 动态尺寸输入需要合理的 Padding/Crop 策略
- INT8 量化后小目标检测精度下降明显，需要量化感知训练（QAT）缓解
- 不同推理后端对特定算子的支持程度不同

### 10.5 长期运行稳定性
- 数小时的连续推理可能遇到单帧异常（光照突变、场景切换）
- 内存泄漏或不合理的缓存策略导致 OOM 崩溃
- 不同视频源的色彩空间和编解码格式差异需要适配

## 11. 参考资料

- Ren et al., Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks, NIPS 2015
- Redmon et al., You Only Look Once: Unified, Real-Time Object Detection, CVPR 2016
- Lin et al., Focal Loss for Dense Object Detection, ICCV 2017
- Tian et al., FCOS: Fully Convolutional One-Stage Object Detection, ICCV 2019
- Carion et al., End-to-End Object Detection with Transformers, ECCV 2020
- Ge et al., YOLOX: Exceeding YOLO Series in 2021, arXiv 2021
- mmdetection: https://github.com/open-mmlab/mmdetection
