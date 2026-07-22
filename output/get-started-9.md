*   [English](/docs/4.x/table-design/overview/)
*   [中文](/zh-CN/docs/4.x/table-design/overview/)
*   [日本語](/ja/docs/4.x/table-design/overview/)

最后于 **2026年5月22日** 更新

# Apache Doris 表结构设计指南

在 Apache Doris 中，表的设计直接决定了写入性能、查询效率与存储成本。本章节按典型设计场景组织内容，帮助您从零完成一张表的设计，或对已有表进行结构优化。

## 设计流程[​](#设计流程 "设计流程的直接链接")

设计一张 Doris 表通常包含以下步骤：

1.  **选择表模型**：决定数据如何存储、去重与聚合；
2.  **定义列与数据类型**：根据业务字段选择合适的类型；
3.  **规划分区与分桶**：让数据均匀分布并便于裁剪；
4.  **添加索引**：加速点查、范围扫描或全文检索；
5.  **优化存储**：通过压缩、行列混存或冷热分层降低成本；
6.  **演进表结构**：随业务变化调整 Schema 或使用自增列。

## 创建表[​](#创建表 "创建表的直接链接")

使用 [CREATE TABLE](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/CREATE-TABLE/) 语句即可在 Doris 中创建一张表。如果希望基于已有表派生新表，可以使用：

*   [CREATE TABLE … LIKE](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/CREATE-TABLE/)：复用已有表的结构；
*   [CREATE TABLE … AS SELECT (CTAS)](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/CREATE-TABLE/)：基于查询结果创建表。

### 表名规则[​](#表名规则 "表名规则的直接链接")

Doris 中表名默认大小写敏感，最大长度为 64 字节。可通过以下配置调整：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| [lower\_case\_table\_names](/zh-CN/docs/4.x/admin-manual/config/fe-config/) | 大小写敏感 | 仅在集群首次初始化时配置，后续不可更改 |
| [table\_name\_length\_limit](/zh-CN/docs/4.x/admin-manual/config/fe-config/) | 64 字节 | 不建议设置过大 |

### 关键表属性[​](#关键表属性 "关键表属性的直接链接")

建表时可在 PROPERTIES 中指定常用属性，详见 [CREATE TABLE](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/CREATE-TABLE/)：

| 属性 | 作用 |
| --- | --- |
| `buckets` | 决定数据在表中的分布粒度 |
| `storage_medium` | 控制存储介质，例如 HDD、SSD 或远程共享存储 |
| `replication_num` | 控制数据副本数量，保证冗余与可靠性 |
| `storage_policy` | 配置冷热数据分层迁移策略 |

提示

表属性作用于分区。修改表属性只对未来创建的分区生效，已有分区不受影响。详见 [ALTER TABLE PROPERTY](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/ALTER-TABLE-PROPERTY/) 与 [ALTER TABLE DISTRIBUTION](/zh-CN/docs/4.x/table-design/sql-manual/sql-statements/table-and-view/table/ALTER-TABLE-DISTRIBUTION/)。[动态分区](/zh-CN/docs/4.x/table-design/data-partitioning/dynamic-partitioning/) 可单独设置这些属性。

## 选择表模型[​](#选择表模型 "选择表模型的直接链接")

[

### 表模型概述

对比明细模型、聚合模型与主键模型，根据业务场景选择合适的数据存储与去重方式



](/zh-CN/docs/4.x/table-design/data-model/intro/)[

### 明细模型 (Duplicate)

保留原始明细数据，适用于日志、事件等无需去重或聚合的场景



](/zh-CN/docs/4.x/table-design/data-model/duplicate/)[

### 主键模型 (Unique)

基于主键去重并支持高并发实时更新，适合 CDC、订单等按主键更新的场景



](/zh-CN/docs/4.x/table-design/data-model/unique/)[

### 聚合模型 (Aggregate)

按维度预聚合数据，提升报表与多维分析查询性能



](/zh-CN/docs/4.x/table-design/data-model/aggregate/)[

### 模型选择建议

结合典型业务场景给出表模型与 Key 列的设计建议



](/zh-CN/docs/4.x/table-design/data-model/tips/)

## 定义列与数据类型[​](#定义列与数据类型 "定义列与数据类型的直接链接")

[

### 数据类型

查阅 Doris 支持的数值、字符串、日期、半结构化等所有数据类型



](/zh-CN/docs/4.x/table-design/data-type/)

## 规划分区与分桶[​](#规划分区与分桶 "规划分区与分桶的直接链接")

[

### 数据分布概念

理解分区与分桶如何将数据映射到 Tablet，以充分利用多节点的存储与计算能力



](/zh-CN/docs/4.x/table-design/data-partitioning/basic-concepts/)[

### 基础概念

分区、分桶、Tablet、副本等数据分布相关基础术语说明



](/zh-CN/docs/4.x/table-design/data-partitioning/basic-concepts/)[

### 手动分区

在建表时显式定义分区范围，适用于分区固定、需要精细控制的场景



](/zh-CN/docs/4.x/table-design/data-partitioning/manual-partitioning/)[

### 动态分区

按时间维度自动创建与回收分区，简化时间序列表的运维



](/zh-CN/docs/4.x/table-design/data-partitioning/dynamic-partitioning/)[

### 自动分区

按写入数据自动创建分区，避免预先定义分区范围



](/zh-CN/docs/4.x/table-design/data-partitioning/auto-partitioning/)[

### 数据分桶

选择合适的分桶列与分桶数，让数据在分区内均匀分布



](/zh-CN/docs/4.x/table-design/data-partitioning/data-bucketing/)[

### 常见问题

分区分桶设计中常见的错误与排查方法



](/zh-CN/docs/4.x/table-design/data-partitioning/common-issues/)

## 加速查询：索引[​](#加速查询索引 "加速查询：索引的直接链接")

[

### 索引概述

对比 Doris 支持的各类索引及其适用查询场景



](/zh-CN/docs/4.x/table-design/index/index-overview/)[

### 前缀索引

基于排序键的内置索引，加速等值与范围查询



](/zh-CN/docs/4.x/table-design/index/prefix-index/)[

### BloomFilter 索引

加速高基数列的等值查询，减少不必要的数据扫描



](/zh-CN/docs/4.x/table-design/index/bloomfilter/)[

### NGram BloomFilter 索引

加速 LIKE 模糊匹配查询，无需引入完整倒排索引



](/zh-CN/docs/4.x/table-design/index/ngram-bloomfilter-index/)[

### 倒排索引（全文检索）

支持分词全文检索、关键字与短语匹配，适用于日志与文本分析



](/zh-CN/docs/4.x/table-design/index/inverted-index/overview/)[

### 向量索引

基于 HNSW、IVF 等算法加速高维向量的相似度检索



](/zh-CN/docs/4.x/table-design/index/vector-index/hnsw/)

## 优化存储[​](#优化存储 "优化存储的直接�链接")

[

### 存储格式

了解 Doris 列式存储格式 V3 的设计与优势



](/zh-CN/docs/4.x/table-design/storage-format/)[

### 数据压缩

选择合适的压缩算法，在存储成本与查询性能之间取得平衡



](/zh-CN/docs/4.x/table-design/column-compression/)[

### 行列混存

在列存基础上额外保存行存，加速宽表点查



](/zh-CN/docs/4.x/table-design/row-store/)[

### 冷热数据分层

将冷数据下沉到 SSD/HDD 或 S3、HDFS 等远程存储，降低存储成本



](/zh-CN/docs/4.x/table-design/tiered-storage/overview/)

## 演进表结构[​](#演进表结构 "演进表结构的直接链接")

[

### Schema 变更

通过 ALTER TABLE 增删修改列与类型，了解轻量级与重量级变更的差异



](/zh-CN/docs/4.x/table-design/schema-change/)[

### 自增列

使用 Auto Increment Column 自动生成唯一数字 ID，简化数据写入



](/zh-CN/docs/4.x/table-design/auto-increment/)

## 特殊表与最佳实践[​](#特殊表与最佳实践 "特殊表与最佳实践的直接链接")

[

### 临时表

将复杂 SQL 拆分为多步并暂存中间结果，便于调试与复用



](/zh-CN/docs/4.x/table-design/temporary-table/)[

### 建表最佳实践

汇总表模型、Key 列、分区分桶、索引等关键设计建议



](/zh-CN/docs/4.x/table-design/data-model/tips/)

## 设计注意事项[​](#设计注意事项 "设计注意事项的直接链接")

| 设计项 | 说明 | 影响 |
| --- | --- | --- |
| 数据模型 | 建表后**不可修改**，需提前选择合适的[数据模型](/zh-CN/docs/4.x/table-design/data-model/intro/) | 决定后续写入与查询模式 |
| 分桶数 | 已创建分区的分桶数不可修改，可通过[替换分区](/zh-CN/docs/4.x/data-operate/delete/table-temp-partition/)调整；动态分区中未来分区的分桶数可修改 | 影响数据均衡与查询并行度 |
| 列变更 | 增删 VALUE 列是轻量级操作（秒级完成）；增删 KEY 列或修改数据类型是重量级操作 | 大数据量下应尽量避免 KEY 列变更 |
| 存储策略 | 通过[冷热分层](/zh-CN/docs/4.x/table-design/tiered-storage/overview/)将冷数据迁移到 HDD、S3 或 HDFS | 显著降低存储成本 |