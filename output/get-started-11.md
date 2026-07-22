*   [English](/docs/4.x/data-operate/update-and-delete/)
*   [中文](/zh-CN/docs/4.x/data-operate/update-and-delete/)
*   [日本語](/ja/docs/4.x/data-operate/update-and-delete/)

最后于 **2026年5月17日** 更新

# 数据更新与删除

Apache Doris 提供灵活的数据更新与删除机制，并通过事务能力保证写入操作的可靠性与一致性。

[

### 数据更新

通过 SQL UPDATE、部分列更新以及 Unique Key 模型 Upsert 更新已有数据



](/zh-CN/docs/4.x/data-operate/update/update-overview/)[

### 数据删除

使用 DELETE、批量删除、TRUNCATE、原子覆盖以及临时分区清理数据



](/zh-CN/docs/4.x/data-operate/delete/delete-overview/)[

### 事务

使用显式与隐式事务，将多个写入操作组合为原子单元



](/zh-CN/docs/4.x/data-operate/transaction/)