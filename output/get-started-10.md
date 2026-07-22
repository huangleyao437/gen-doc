*   [English](/docs/4.x/data-operate/import/load-manual/)
*   [中文](/zh-CN/docs/4.x/data-operate/import/load-manual/)
*   [日本語](/ja/docs/4.x/data-operate/import/load-manual/)

最后于 **2026年5月20日** 更新

# 导入概览

Apache Doris 提供了多种数据导入与集成方式，帮助您从不同数据源将数据写入数据库。本篇文档从典型业务场景出发，介绍如何在 **实时写入**、**流式同步**、**批量导入**、**外部数据源集成** 四类方式中选择最合适的方案。

## 快速导航[​](#快速导航 "快速导航的直接链接")

按照数据来源与时效性需求，可以参考下表快速定位推荐的导入方式：

| 业务场景 | 数据来源 | 推荐导入方式 |
| --- | --- | --- |
| 应用程序实时写入（极少量、5 分钟级） | JDBC 客户端 | [JDBC INSERT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) |
| 应用程序高并发或高频小批量写入 | JDBC / HTTP | [Group Commit](/zh-CN/docs/4.x/data-operate/import/load-best-practices/group-commit-manual/) + JDBC INSERT 或 Stream Load |
| 应用程序高吞吐写入 | HTTP | [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/) |
| 实时数据流接入 | Flink | [Flink Doris Connector](/zh-CN/docs/4.x/connection-integration/data-integration/flink-doris-connector/) |
| 实时消息队列接入 | Kafka | [Routine Load](/zh-CN/docs/4.x/data-operate/import/import-way/routine-load-manual/) 或 [Doris Kafka Connector](/zh-CN/docs/4.x/connection-integration/data-integration/doris-kafka-connector/) |
| 事务数据库实时同步（无需外部组件） | MySQL / PostgreSQL | [Streaming Job 持续导入](/zh-CN/docs/4.x/data-operate/import/import-way/streaming-job/continuous-load-overview/) |
| 事务数据库 CDC 同步 | MySQL / PostgreSQL 等 | [Flink CDC](/zh-CN/docs/4.x/connection-integration/data-integration/flink-doris-connector/) 或 [DataX](/zh-CN/docs/4.x/connection-integration/data-integration/datax/) |
| 对象存储持续导入（增量文件自动加载） | S3 | [Streaming Job 持续导入](/zh-CN/docs/4.x/data-operate/import/import-way/streaming-job/continuous-load-overview/) |
| 对象存储 / HDFS 文件批量导入 | S3 / OSS / HDFS | [Broker Load](/zh-CN/docs/4.x/data-operate/import/import-way/broker-load-manual/) 或 [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) |
| 本地文件批量导入 | 本地磁盘 | [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/) 或 [Doris Streamloader](/zh-CN/docs/4.x/connection-integration/data-integration/doris-streamloader/) |
| 外部数据源（数据湖/外部表）查询并导入 | Hive / Iceberg / JDBC 等 | [Catalog](/zh-CN/docs/4.x/lakehouse/lakehouse-overview/) + [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) |

> Doris 的每次导入默认都是一个隐式事务，事务相关的更多信息请参考[事务](/zh-CN/docs/4.x/data-operate/transaction/)。

## 按场景选择导入方式[​](#按场景选择导入方式 "按场景选择导入方式的直接链接")

### 实时写入：应用程序直接写入[​](#实时写入应用程序直接写入 "实时写入：应用程序直接写入的直接链接")

适用于应用程序通过 HTTP 或 JDBC **实时写入** 数据到 Doris 表的场景，常用于需要实时分析和查询的业务。

*   **极少量数据（约 5 分钟一次）**：使用 [JDBC INSERT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) 写入数据。
*   **高并发或高频次（大于 20 并发，或 1 分钟内多次写入）**：建议开启 [Group Commit](/zh-CN/docs/4.x/data-operate/import/load-best-practices/group-commit-manual/)，配合 JDBC INSERT 或 Stream Load 使用。
*   **高吞吐写入**：推荐使用 [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/) 通过 HTTP 协议写入。

### 流式同步：实时数据流接入[​](#流式同步实时数据流接入 "流式同步：实时数据流接入的直接链接")

适用于通过实时数据流（如 Flink、Kafka、事务数据库 CDC）将数据持续同步到 Doris 表的场景。

1.  **Flink 实时数据流**
    
    使用 [Flink Doris Connector](/zh-CN/docs/4.x/connection-integration/data-integration/flink-doris-connector/) 将 Flink 的实时数据流写入到 Doris 表中。
    
2.  **Kafka 实时数据流**
    
    可选 [Routine Load](/zh-CN/docs/4.x/data-operate/import/import-way/routine-load-manual/) 或 [Doris Kafka Connector](/zh-CN/docs/4.x/connection-integration/data-integration/doris-kafka-connector/)，二者差异如下：
    
    | 方式 | 数据流向 | 支持格式 |
    | --- | --- | --- |
    | Routine Load | Doris 主动从 Kafka 拉取数据 | csv、json |
    | Kafka Connector | Kafka 主动将数据写入 Doris | avro、json、csv、protobuf |
    
3.  **事务数据库 CDC 同步**
    
    可使用 [Flink CDC](/zh-CN/docs/4.x/connection-integration/data-integration/flink-doris-connector/) 或 [DataX](/zh-CN/docs/4.x/connection-integration/data-integration/datax/) 将事务数据库的 CDC 数据流写入到 Doris 中。
    
4.  **Streaming Job 持续导入（无需外部组件）**
    
    通过 Doris 内置的 [Streaming Job](/zh-CN/docs/4.x/data-operate/import/import-way/streaming-job/continuous-load-overview/) 直接从 MySQL、PostgreSQL、S3 等数据源持续读取数据并写入 Doris，**无需依赖 Flink、Kafka 等外部组件**。支持两种同步方式：
    
    | 同步方式 | 底层机制 | 自动建表 | 语义保证 | 典型场景 |
    | --- | --- | --- | --- | --- |
    | SQL 映射同步 | Job + TVF（INSERT INTO SELECT） | 需预建 | exactly-once | 需要列裁剪、字段重命名、类型转换、条件过滤 |
    | 自动建表同步 | Job + 原生整库 DDL | 首次自动创建 | at-least-once | 整库或一组表的镜像复制，下游表结构自动跟随上游 |
    

### 批量导入：外部存储文件加载[​](#批量导入外部存储文件加载 "批量导入：外部存储文件加载的直接链接")

适用于将外部存储系统（如对象存储、HDFS、本地文件、NAS）中的文件 **批量加载** 到 Doris 表的非实时场景。

*   **对象存储 / HDFS 文件**：使用 [Broker Load](/zh-CN/docs/4.x/data-operate/import/import-way/broker-load-manual/) 写入到 Doris 中。
*   **对象存储 / HDFS / NAS 文件（同步或异步）**：使用 [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) 同步写入；如需异步执行，可配合 [JOB](/zh-CN/docs/4.x/data-operate/admin-manual/workload-management/job-scheduler/) 调度。
*   **本地文件**：使用 [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/) 或 [Doris Streamloader](/zh-CN/docs/4.x/data-operate/connection-integration/data-integration/doris-streamloader/) 写入到 Doris 中。

### 外部数据源集成：Catalog 联邦查询与导入[​](#外部数据源集成catalog-联邦查询与导入 "外部数据源集成：Catalog 联邦查询与导入的直接链接")

适用于通过与外部数据源（如 Hive、JDBC、Iceberg 等）集成，对外部数据进行查询并 **按需导入** 到 Doris 表的场景。

*   通过创建 [Catalog](/zh-CN/docs/4.x/lakehouse/lakehouse-overview/) 读取外部数据源中的数据。
*   使用 [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) 将外部数据源数据同步写入 Doris；如需异步执行，可配合 [JOB](/zh-CN/docs/4.x/data-operate/admin-manual/workload-management/job-scheduler/) 调度。

## 导入时进行部分列更新[​](#导入时进行部分列更新 "导入时进行部分列更新的直接链接")

Doris 支持在数据导入时进行 **部分列更新**，允许您只更新表中的特定列，而不需要提供所有列的值。该能力对以下场景特别有用：

*   更新宽表中的少量字段
*   执行增量更新（Upsert 部分列）

关于如何对主键模型和聚合模型表进行部分列更新的详细信息，请参考[列更新](/zh-CN/docs/4.x/data-operate/update/partial-column-update/)。

## 导入方式总览[​](#导入方式总览 "导入方式总览的直接链接")

Doris 的导入主要涉及数据源、数据格式、导入方式、错误数据处理、数据转换、事务等多个方面。下表汇总了各导入方式适合的场景、支持的文件格式以及导入模式：

| 导入方式 | 使用场景 | 支持的文件格式 | 导入模式 |
| --- | --- | --- | --- |
| [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/) | 导入本地文件或者应用程序写入 | csv、json、parquet、orc | 同步 |
| [Broker Load](/zh-CN/docs/4.x/data-operate/import/import-way/broker-load-manual/) | 从对象存储、HDFS 等导入 | csv、json、parquet、orc | 异步 |
| [INSERT INTO VALUES](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) | 通过 JDBC 等接口导入 | SQL | 同步 |
| [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) | 可以导入外部表或者对象存储、HDFS 中的文件 | SQL | 同步 |
| [Routine Load](/zh-CN/docs/4.x/data-operate/import/import-way/routine-load-manual/) | 从 Kafka 实时导入 | csv、json | 异步 |
| [MySQL Load](/zh-CN/docs/4.x/data-operate/import/import-way/mysql-load-manual/) | 从本地数据导入 | csv | 同步 |
| [Group Commit](/zh-CN/docs/4.x/data-operate/import/load-best-practices/group-commit-manual/) | 高频小批量导入 | 根据使用的导入方式而定 | \- |
| [Streaming Job](/zh-CN/docs/4.x/data-operate/import/import-way/streaming-job/continuous-load-overview/) | 从 MySQL、PostgreSQL、S3 等数据源持续导入 | 取决于数据源 | 异步 |

## 常见问题[​](#常见问题 "常见问题的直接链接")

**Q1：高并发小批量写入应该选择哪种导入方式？**

建议开启 [Group Commit](/zh-CN/docs/4.x/data-operate/import/load-best-practices/group-commit-manual/)，并配合 JDBC INSERT 或 Stream Load 使用。当并发大于 20，或 1 分钟内写入多次时，Group Commit 可显著降低导入压力。

**Q2：Routine Load 与 Doris Kafka Connector 有何区别？**

*   Routine Load：由 Doris 调度任务从 Kafka **主动拉取** 数据，支持 csv、json 格式。
*   Doris Kafka Connector：由 Kafka 将数据 **主动推送** 到 Doris，支持 avro、json、csv、protobuf 格式。

**Q3：如何将本地文件导入到 Doris？**

可以使用 [Stream Load](/zh-CN/docs/4.x/data-operate/import/load-manual/import-way/stream-load-manual/)（适合中小文件）或 [Doris Streamloader](/zh-CN/docs/4.x/connection-integration/data-integration/doris-streamloader/)（适合大文件批量场景）。

**Q4：能否将 Hive、Iceberg 等外部数据源的数据导入 Doris？**

可以。先通过 [Catalog](/zh-CN/docs/4.x/lakehouse/lakehouse-overview/) 接入外部数据源，再使用 [INSERT INTO SELECT](/zh-CN/docs/4.x/data-operate/import/import-way/insert-into-manual/) 将数据同步写入 Doris；若需要异步执行，可结合 [JOB](/zh-CN/docs/4.x/data-operate/admin-manual/workload-management/job-scheduler/) 调度。

**Q5：导入是否具备事务保证？**

是。Doris 的每次导入默认都是一个隐式事务，详细内容请参考[事务](/zh-CN/docs/4.x/data-operate/transaction/)。

**Q6：Streaming Job 与 Flink CDC 该如何选择？**

*   **Streaming Job**：Doris 内置能力，**无需依赖 Flink、Kafka 等外部组件**，支持 MySQL、PostgreSQL 的 SQL 映射 / 自动建表同步以及 S3 持续导入。自动建表同步会在首次同步时自动建表，SQL 映射同步提供 exactly-once 语义并支持 SQL 加工。
*   **Flink CDC**：需要部署 Flink 集群，适合已有 Flink 流处理体系、需要复杂 ETL 加工或多端同步的场景。

如果只是把 MySQL/PostgreSQL 数据持续同步到 Doris，且无外部流处理需求，**优先选择 Streaming Job**，详见 [持续导入概览](/zh-CN/docs/4.x/data-operate/import/import-way/streaming-job/continuous-load-overview/)。