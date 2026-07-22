*   [English](/docs/4.x/query-acceleration/performance-tuning-intro/)
*   [中文](/zh-CN/docs/4.x/query-acceleration/performance-tuning-intro/)
*   [日本語](/ja/docs/4.x/query-acceleration/performance-tuning-intro/)

最后于 **2026年5月17日** 更新

# 性能与调优

Apache Doris 的自适应优化器和 Pipeline 执行引擎可以让大多数业务开箱即用，但生产环境通常还需要系统化的性能调优。建议先按照调优方法论定位瓶颈，再针对查询或导入侧的具体场景进行优化；遇到难以解释的执行计划时，可以查阅优化技术原理来理解其背后的机制。

## 调优方法论[​](#调优方法论 "调优方法论的直接链接")

[

### 性能调优概览

了解端到端的调优流程，掌握 Doris 提供的诊断与分析工具，以及如何系统化地定位性能问题。



](/zh-CN/docs/4.x/query-acceleration/performance-tuning-overview/tuning-overview/)

## 查询性能[​](#查询性能 "查询性能的直接链接")

[

### 表结构与索引优化

通过表模型、分区分桶、Key 列设计与索引选择（前缀索引、BloomFilter、NGram、倒排）确定查询性能上限。



](/zh-CN/docs/4.x/query-acceleration/tuning/tuning-plan/schema-and-index-optimization/)[

### 物化视图

使用同步或异步物化视图预计算结果，结合透明改写让已有 SQL 无需修改即可享受加速。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/intro/)[

### Join 优化

使用 Colocation Join 消除 Shuffle，借助 Distribute 与 Leading Hint 在优化器决策不理想时手动调整 Join 计划。



](/zh-CN/docs/4.x/query-acceleration/join-optimization-intro/)[

### 缓存加速

组合使用 SQL Cache、Condition Cache 与外表文件缓存，在重复查询中复用结果、过滤计算与远端数据。



](/zh-CN/docs/4.x/query-acceleration/caching-intro/)[

### 执行调优

基于 Profile 中的运行时瓶颈，调整并行度、RuntimeFilter 等待时间、数据倾斜以及 CBO 规则。



](/zh-CN/docs/4.x/query-acceleration/tuning/tuning-execution/intro/)[

### 高并发与点查询

通过行存、短路执行让 Unique Key 表支持高 QPS 主键查询，并使用字典表替代维表 Join 加速 KV 查询。



](/zh-CN/docs/4.x/query-acceleration/high-concurrency-intro/)[

### 去重计数

使用 BITMAP 实现精确去重，或在可接受 1%–2% 误差时使用 HLL 进行近似 UV 计算，显著降低内存与存储开销。



](/zh-CN/docs/4.x/query-acceleration/distinct-counts/intro/)[

### 查询 Profile

通过 Profile 分析 Scan、Exchange、Join、聚合等算子的耗时分布，快速定位查询的最慢阶段。



](/zh-CN/docs/4.x/query-acceleration/query-profile/)

## 导入性能[​](#导入性能 "导入性能的直接链接")

[

### DML 调优

针对 INSERT、UPDATE、DELETE 的执行计划，调整写入并行度、批量大小与执行路径，获得稳定的导入性能。



](/zh-CN/docs/4.x/query-acceleration/tuning/tuning-plan/dml-tuning-plan/)

## 优化技术原理[​](#优化技术原理 "优化技术原理的直接链接")

[

### 查询优化器

介绍 Nereids 优化器的规则改写与代价模型，包括基于规则的等价变换以及基于代价的 Join Enumeration。



](/zh-CN/docs/4.x/query-acceleration/optimization-technology-principle/query-optimizer/)[

### Pipeline 执行引擎

介绍 Pipeline 模型、调度机制以及 Morsel-Driven 并行执行，构成 Doris 的执行层基础。



](/zh-CN/docs/4.x/query-acceleration/optimization-technology-principle/pipeline-execution-engine/)[

### Runtime Filter

介绍 RuntimeFilter 在 Join 构建侧生成、并下推到探测侧来跳过无关数据的执行机制。



](/zh-CN/docs/4.x/query-acceleration/optimization-technology-principle/runtime-filter/)[

### TopN 优化

介绍 ORDER BY ... LIMIT 场景下的短路执行与部分排序优化，跳过大部分数据快速返回 TopN。



](/zh-CN/docs/4.x/query-acceleration/optimization-technology-principle/topn-optimization/)[

### 统计信息

介绍表、列与直方图等统计信息的采集与使用，是基于代价的查询优化器选择计划的基础。



](/zh-CN/docs/4.x/query-acceleration/optimization-technology-principle/statistics/)

## 基准测试[​](#基准测试 "基准测试的直接链接")

[

### Star Schema Benchmark (SSB)

Doris 在标准硬件上的 SSB 测试结果，包含可复现的环境配置与调优要点。



](/zh-CN/docs/4.x/benchmark/ssb/)[

### TPC-H

Doris 的 TPC-H 测试结果，涵盖数据导入、查询延迟与对比指引。



](/zh-CN/docs/4.x/benchmark/tpch/)[

### TPC-DS

Doris 在更复杂多表分析场景下的 TPC-DS 测试结果。



](/zh-CN/docs/4.x/benchmark/tpcds/)