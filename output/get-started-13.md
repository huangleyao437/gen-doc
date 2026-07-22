*   [English](/docs/4.x/query-data/querying-overview/)
*   [中文](/zh-CN/docs/4.x/query-data/querying-overview/)
*   [日本語](/ja/docs/4.x/query-data/querying-overview/)

最后于 **2026年5月17日** 更新

# 数据查询

Apache Doris 支持标准 SQL 并高度兼容 MySQL，在此基础上提供了高性能的关联查询、丰富的分析函数、半结构化数据访问以及用户自定义函数等能力。请按下方场景选择对应的文档。

## SQL 兼容[​](#sql-兼容 "SQL 兼容的直接链接")

[

### MySQL 兼容性

Doris 与 MySQL 的差异速查：覆盖数据类型、DDL/DML 语法、SQL 函数与 SQL Mode 的关键不同点。



](/zh-CN/docs/4.x/query-data/mysql-compatibility/)

## 多表关联[​](#多表关联 "多表关联的直接链接")

[

### 连接（JOIN）

INNER / LEFT / RIGHT / FULL / SEMI / ANTI 等 JOIN 类型，以及 Broadcast、Shuffle、Bucket Shuffle、Colocate 四种分布式 JOIN 实现方式。



](/zh-CN/docs/4.x/query-data/join/)[

### ASOF JOIN 时序近邻匹配

为左表每行在右表中按时间方向查找最近的一行，无需窗口函数即可完成时序数据对齐。



](/zh-CN/docs/4.x/query-data/asof-join/)[

### 子查询

标量、非标量、关联与非关联子查询的语法、限制与 Mark Join 处理细节。



](/zh-CN/docs/4.x/query-data/subquery/)[

### 公用表表达式（CTE）

通过 WITH 子句定义临时结果集，支持嵌套与递归 CTE，适用于层级遍历、图遍历等场景。



](/zh-CN/docs/4.x/query-data/cte/)

## 聚合与分析[​](#聚合与分析 "聚合与分析的直接链接")

[

### 聚合多维分析

使用 ROLLUP、CUBE、GROUPING SETS 在单条 SQL 中完成多维度聚合分析。



](/zh-CN/docs/4.x/query-data/multi-dimensional-analytics/)[

### 分析函数（窗口函数）

通过 OVER 子句对结果集分区与开窗，实现排名、累计求和、移动平均、同比环比等场景。



](/zh-CN/docs/4.x/query-data/window-function/)

## 半结构化与复杂数据[​](#半结构化与复杂数据 "半结构化与复杂数据的直接链接")

[

### 复杂类型查询

查询 Array、Map、Struct、JSON 等复杂类型，并通过专用 SQL 函数处理半结构化数据。



](/zh-CN/docs/4.x/query-data/complex-type/)[

### 列转行 (Lateral View)

LATERAL VIEW 配合 EXPLODE 等生成器函数将一行展开为多行，实现 SQL 列转行查询。



](/zh-CN/docs/4.x/query-data/lateral-view/)

## 自定义函数（UDF）[​](#自定义函数udf "自定义函数（UDF）的直接链接")

[

### Java UDF / UDAF / UDWF / UDTF

使用 Java 编写 UDF/UDAF/UDWF/UDTF 自定义函数，包含类型映射、注册语法、最佳实践与示例。



](/zh-CN/docs/4.x/query-data/udf/java-user-defined-function/)[

### Python UDF / UDAF / UDWF / UDTF

使用 Python 编写 UDF/UDAF/UDTF：覆盖创建、向量化、环境配置与常见问题排查。



](/zh-CN/docs/4.x/query-data/udf/python-user-defined-function/)[

### 别名函数

通过 CREATE ALIAS FUNCTION 为函数或表达式片段注册新签名，提升迁移兼容性并简化复杂查询书写。



](/zh-CN/docs/4.x/query-data/udf/alias-function/)