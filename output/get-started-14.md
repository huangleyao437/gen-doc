*   [English](/docs/4.x/query-acceleration/materialized-view/intro/)
*   [中文](/zh-CN/docs/4.x/query-acceleration/materialized-view/intro/)
*   [日本語](/ja/docs/4.x/query-acceleration/materialized-view/intro/)

最后于 **2026年5月17日** 更新

# 物化视图

物化视图是既包含计算逻辑、也包含数据的实体，可用于查询加速、轻量化 ETL 建模以及湖仓联邦查询加速。建议先理解概念，再根据时效性需求选择同步或异步物化视图。

## 概念入门[​](#概念入门 "概念入门的直接链接")

[

### 物化视图概览

理解物化视图的适用场景，并按时效性、SQL 模式与刷新方式做出选型决策。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/overview/)

## 同步物化视图[​](#同步物化视图 "同步物化视图的直接链接")

[

### 同步物化视图

使用同步物化视图保持与基表强一致的数据，加速实时聚合与排序场景。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/sync-materialized-view/)[

### 同步物化视图透明改写

了解优化器如何把查询透明改写到同步物化视图，包括支持的模式与限制。



](/zh-CN/docs/4.x/query-acceleration/tuning/tuning-plan/transparent-rewriting-with-sync-mv/)

## 异步物化视图[​](#异步物化视图 "异步物化视图的直接链接")

[

### 异步物化视图概览

掌握异步物化视图的刷新模式、多表支持、分区增量刷新与典型使用场景。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/async-materialized-view/overview/)[

### 创建与维护

异步物化视图的创建、直接查询、刷新管理与分区维护操作手册。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/async-materialized-view/functions-and-demands/)[

### 使用指南

给出场景判断、使用原则、刷新策略选择与构建落地的最佳实践。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/async-materialized-view/use-guide/)[

### 异步物化视图透明改写

基于 SPJG 模式的改写算法如何把已有查询透明改写到异步物化视图，无需修改 SQL。



](/zh-CN/docs/4.x/query-acceleration/tuning/tuning-plan/transparent-rewriting-with-async-mv/)[

### 常见问题

围绕分区刷新、基表版本与运维排障的高频问题解答。



](/zh-CN/docs/4.x/query-acceleration/materialized-view/async-materialized-view/faq/)