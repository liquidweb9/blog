# 论文来源索引

记录研读使用的原稿来源和版本。PDF 与补充材料保存在本地或坚果云，本文件随 Git 跟踪。

| 论文 | 官方来源 | 研读版本 | 本地原稿位置 | 坚果云分享 |
| --- | --- | --- | --- | --- |
| Weaver: Shrinking the Generation-Verification Gap by Scaling Compute for Verification | [OpenReview](https://openreview.net/forum?id=dRjt4vlYVQ) · [PDF](https://openreview.net/pdf?id=dRjt4vlYVQ) | 2026-10-16 下载的 OpenReview 当前 PDF，45 页，主表平均 86.2% | `llm-agents/2025-weaver/paper.pdf` | 未设置 |
| FedSVD: Adaptive Orthogonalization for Private Federated Learning with LoRA | [arXiv](https://arxiv.org/abs/2505.12805) · [v2 PDF](https://arxiv.org/pdf/2505.12805v2) | arXiv v2，2025-10-25 修订；2026-10-21 下载，25 页 | `cryptography/2025-fedsvd/paper.pdf` | 未设置 |
| When the Aggregator Cheats: Data-Free Backdoors in Federated LLM-based QA Systems | [USENIX](https://www.usenix.org/conference/usenixsecurity26/presentation/zhu-chenqing) · [arXiv v1](https://arxiv.org/abs/2606.27511v1) · [v1 PDF](https://arxiv.org/pdf/2606.27511v1) | arXiv v1，2026-06-25；2026-10-29 下载，20 页 | `cryptography/2026-aggregator-cheats/paper.pdf` | 未设置 |
| Robust Federated Finetuning of LLMs via Alternating Optimization of LoRA | [arXiv](https://arxiv.org/abs/2502.01755) · [v4 PDF](https://arxiv.org/pdf/2502.01755v4) · [OpenReview](https://openreview.net/forum?id=e8DrPuJekZ) | arXiv v4，2025-10-11 修订；2026-11-02 下载，53 页 | `cryptography/2025-rolora/paper.pdf` | 未设置 |
| Rethinking LoRA for Privacy-Preserving Federated Learning in Large Models | [arXiv v1](https://arxiv.org/abs/2602.19926v1) · [v1 PDF](https://arxiv.org/pdf/2602.19926v1) | arXiv v1，2026-02-23；2026-11-02 下载，36 页 | `cryptography/2026-la-lora/paper.pdf` | 未设置 |

本地原稿位置相对于 `paper-originals/`。新增论文时，补充完整标题、官方 URL、版本或修订日期和实际保存位置；分享链接按需填写。

## Weaver 原稿记录

- 原稿下载日期：2026-10-16。
- OpenReview PDF 附件标识：`e96545cd91e3d21ec915c2a775d66c7fe5f57eb6`。
- PDF 内标题：*WEAVER: Shrinking the Generation-Verification Gap with Weak Verifiers*。
- 文件大小：7,894,956 字节，约 7.53 MiB。
- SHA-256：`eba6b3f0d2e101b6f9918cf27b2cb4da408b15b110736c48a91a543e9f8198b6`。
- 原稿许可：CC BY 4.0，依据 OpenReview 元数据。
- 对应文章：[`docs/papers/llm-agents/2026-10-16-weaver.md`](../docs/papers/llm-agents/2026-10-16-weaver.md)。
- 本地另存 `llm-agents/2025-weaver/paper-arxiv-v3.pdf`，用于核对版本差异；[arXiv v3](https://arxiv.org/abs/2506.18203v3) 的主表为 87.7%，不作为本篇主结果来源。
- 补充材料 ZIP 当前未取得；官方实现入口尚待核实。

## FedSVD 原稿记录

- 原稿下载日期：2026-10-21。
- 主版本：`arXiv:2505.12805v2`，2025-10-25 修订，NeurIPS 2025。
- 标题：*FedSVD: Adaptive Orthogonalization for Private Federated Learning with LoRA*。
- 作者：Seanie Lee、Sangwoo Park、Dong Bok Lee、Dominik Wagner、Haebin Seong、Tobias Bocklet、Juho Lee、Sung Ju Hwang。
- 官方全文：[固定版本 PDF](https://arxiv.org/pdf/2505.12805v2) · [同版本 HTML](https://arxiv.org/html/2505.12805v2)。
- 文件大小：841,276 字节；共 25 页，附录 A–D 已包含在 PDF 中。
- SHA-256：`25eaf849d0ba9aacff03584122c8ea0103512ac53e2b494ce85c35efaf17cfc0`。
- 原稿许可：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，依据 arXiv v2 元数据。
- 官方实现：[seanie12/fed-svd](https://github.com/seanie12/fed-svd)。
- 对应文章：[`docs/papers/cryptography/2026-10-21-fedsvd.md`](../docs/papers/cryptography/2026-10-21-fedsvd.md)。
- 本地同目录另存完整提取文本、来源元数据、研读包、裁图脚本与说明例子的数值验算；均不进入 Git 或站点发布目录。

## When the Aggregator Cheats 原稿记录

- 原稿下载日期：2026-10-29。
- 主版本：`arXiv:2606.27511v1`，2026-06-25；USENIX Security 2026，论文集第 241–260 页。
- 标题：*When the Aggregator Cheats: Data-Free Backdoors in Federated LLM-based QA Systems*。
- 作者：Chenqing Zhu、Yanbo Dai、Yulong Tian、Qingming Li、Songze Li。
- 官方全文：[固定版本 PDF](https://arxiv.org/pdf/2606.27511v1) · [同版本 HTML](https://arxiv.org/html/2606.27511v1)。会议入口另提供正式论文 PDF；本篇以固定 arXiv 版本为主，不混用其他版本结果。
- 文件大小：3,088,415 字节；共 20 页，附录 A–C 已包含在 PDF 中。
- SHA-256：`8c1d9de73dd8fa5c2779aa745e9cc05ea45359e14845ef11e4ef03510719c5c7`。
- 原稿许可：arXiv 永久非独占分发许可；未标注 CC BY，不将实验材料仓库的 Apache-2.0 许可套用于论文配图。
- 官方实验材料：[GitHub](https://github.com/S3IC-Lab/when-aggregator-cheats-artifact) · [Zenodo 存档](https://zenodo.org/records/20657291)。已核实入口并保存 README、目录信息及 5 页完整指标补充文档，未进行完整训练复现。
- 对应文章：[`docs/papers/cryptography/2026-10-29-aggregator-cheats.md`](../docs/papers/cryptography/2026-10-29-aggregator-cheats.md)。
- 本地同目录保存提取文本、元数据、研读包、图像提取脚本和例子验算。PDF 与工作资料已被 `.gitignore` 忽略，不随站点发布。

## RoLoRA 原稿记录

- 原稿下载日期：2026-11-02。
- 主版本：`arXiv:2502.01755v4`，2025-10-11 修订，NeurIPS 2025。
- 标题：*Robust Federated Finetuning of LLMs via Alternating Optimization of LoRA*。
- 作者：Shuangyi Chen、Yuanxin Guo、Yue Ju、Hardik Dalal、Zhongwen Zhu、Ashish Khisti。姓名采用 PDF 首页；arXiv 作者元数据将 Hardik 拼为 Harik。
- 官方全文：[固定版本 PDF](https://arxiv.org/pdf/2502.01755v4) · [同版本 HTML](https://arxiv.org/html/2502.01755v4)。正文、主要实验与相关附录均以该版本为准。
- 文件大小：7,834,651 字节；共 53 页，附录 A1–A5 已包含在 PDF 中，末尾含 NeurIPS checklist。
- SHA-256：`43a20ffe7ae34b722a689043a0a999717079d6582547acf80768782a7d64d16a`。
- 原稿许可：arXiv v4 官方页面标注 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)；PDF 第 52 页 checklist 另写 CC BY-NC-SA 4.0。图源声明保留这一差异，以固定 arXiv 版本页面授权为引用依据。
- 对应文章：[`docs/papers/cryptography/2026-11-02-rolora.md`](../docs/papers/cryptography/2026-11-02-rolora.md)。选用原图 1、2、5、12，裁剪坐标和转换信息记录在配图目录 `sources.json`。
- 未核实到官方代码仓库，未进行语言模型训练复现。双客户端说明例子的梯度、聚合、预测与损失已数值验算。
- 本地同目录保存提取文本、来源元数据、研读包、裁图脚本与例子验算；原稿及工作资料不随 Git 或站点发布。

## LA-LoRA 原稿记录

- 下载日期：2026-11-02；主版本 `arXiv:2602.19926v1`，2026-02-23，arXiv 期刊参考为 ICLR 2026。
- 标题：*Rethinking LoRA for Privacy-Preserving Federated Learning in Large Models*。
- 作者：Jin Liu、Yinbin Miao、Ning Xi、Junkang Liu。
- 官方全文：[固定版本 PDF](https://arxiv.org/pdf/2602.19926v1) · [同版本 HTML](https://arxiv.org/html/2602.19926v1)。36 页，包含附录 A–G。
- 文件大小：3,069,795 字节；SHA-256：`48c13f101c0cd5a91eb211ac20d434dc1e19fc84880276efeebf3c64b11fd4ec`。
- 原稿许可：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，依据固定 arXiv 版本页面。
- 对应文章：[`docs/papers/cryptography/2026-11-02-la-lora.md`](../docs/papers/cryptography/2026-11-02-la-lora.md)。原图 1、5 从 PDF 完整嵌入图提取，缩放转换为 WebP；记录见配图 `sources.json`。
- 作者提供的[匿名代码状态页](https://anonymous.4open.science/status/LA-LORA-50E5/)可访问，未核查完整实现或复现训练。已验算说明例子的梯度、裁剪、两端聚合和滤波方差。
- 本地保存 PDF、提取文本、元数据、研读包与提图/验算脚本；原稿和工作资料不随站点发布。模型无法视觉读取图像，未声称完成图内标签视觉审校。
