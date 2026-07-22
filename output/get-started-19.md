*   [English](/docs/4.x/admin-manual/cluster-management/intro/)
*   [中文](/zh-CN/docs/4.x/admin-manual/cluster-management/intro/)
*   [日本語](/ja/docs/4.x/admin-manual/cluster-management/intro/)

最后于 **2026年5月18日** 更新

# 集群管理

本章介绍 Apache Doris 集群在生产环境中常见的运维操作，包括版本升级、容量变更、网络拓扑以及副本维护。

## 集群生命周期[​](#集群生命周期 "集群生命周期的直接链接")

[

### 集群升级

滚动升级指南，涵盖版本兼容性规则、元数据兼容性测试以及 FE/BE 升级步骤



](/zh-CN/docs/4.x/admin-manual/cluster-management/upgrade/)[

### 弹性扩缩容

在线增删 FE/BE 节点而不中断业务，缩容可选择 DROP 或 DECOMMISSION 两种方式



](/zh-CN/docs/4.x/admin-manual/cluster-management/elastic-expansion/)

## 拓扑与访问[​](#拓扑与访问 "拓扑与访问的直接链接")

[

### FQDN

在新集群、存量集群迁移以及 Kubernetes 部署场景下启用 FQDN（完全限定域名）模式



](/zh-CN/docs/4.x/admin-manual/cluster-management/fqdn/)[

### FE 负载均衡

多 FE 部署下的负载均衡方案 —— JDBC、Nginx、HAProxy、ProxySQL，并通过 Proxy Protocol 透传客户端 IP



](/zh-CN/docs/4.x/admin-manual/cluster-management/load-balancing/)

## 服务可用性与副本[​](#服务可用性与副本 "服务可用性与副本的直接链接")

[

### 自动服务启动

使用 Systemd 或 Supervisor 配置 FE/BE/Broker 的开机自启与异常自动拉起



](/zh-CN/docs/4.x/admin-manual/maint-monitor/automatic-service-start/)[

### 数据副本管理

Tablet 副本均衡与修复的调度策略，以及查看和操作副本的常用命令



](/zh-CN/docs/4.x/admin-manual/maint-monitor/tablet-repair-and-balance/)