*   [English](/docs/4.x/getting-started/quick-start/)
*   [中文](/zh-CN/docs/4.x/getting-started/quick-start/)
*   [日本語](/ja/docs/4.x/getting-started/quick-start/)

# 5 分钟快速入门

**完成本教程后，你将能够**

*   使用 Docker 在 5 分钟内启动一个完整的 Doris 集群
*   使用 MySQL 客户端连接集群并验证节点状态
*   创建数据库、表结构，并执行首次数据查询

选择你的部署方式

*   **想快速体验？** → 使用 Docker 部署，5 分钟搞定
*   **想完整了解生产部署？** → 本地完整部署，包含 FE/BE 分离配置

## 使用 Docker 快速部署[​](#使用-docker-快速部署 "使用 Docker 快速部署的直接链接")

自最新版本起，可以使用 Docker 进行快速部署。

### 第 1 步（1/3）：下载启动脚本[​](#第-1-步13下载启动脚本 "第 1 步（1/3）：下载启动脚本的直接链接")

[下载脚本](/files/start-doris.sh)，运行以下命令赋予执行权限：

```
chmod 755 start-doris.sh
```

### 第 2 步（2/3）：启动集群[​](#第-2-步23启动集群 "第 2 步（2/3）：启动集群的直接链接")

运行脚本启动集群（默认使用 4.0.1 版本）：

```
bash start-doris.sh
```

如需指定版本，使用 `-v` 参数：

```
bash start-doris.sh -v 4.1.0
```

### 第 3 步（3/3）：验证集群状态[​](#第-3-步33验证集群状态 "第 3 步（3/3）：验证集群状态的直接链接")

使用 MySQL 客户端连接集群，检查 FE 和 BE 状态：

```
-- 目的：验证 FE 节点是否正常加入集群-- 期望：Join 和 Alive 列均为 truemysql -uroot -P9030 -h127.0.0.1 -e 'SELECT `host`, `join`, `alive` FROM frontends()'
```

```
-- 目的：验证 BE 节点是否正常心跳-- 期望：Alive 列为 1mysql -uroot -P9030 -h127.0.0.1 -e 'SELECT `host`, `alive` FROM backends()'
```

**输出解析：** `Alive=true`（FE）或 `Alive=1`（BE）表示节点运行正常。

* * *

## 本地完整部署[​](#本地完整部署 "本地完整部署的直接链接")

环境要求

*   **操作系统：** Ubuntu 等 AMD/ARM 主流 Linux 环境
*   **Java 环境：** JDK 17+
*   **用户权限：** 推荐新建 Doris 用户，避免使用 root

### 第 1 步（1/4）：下载二进制包[​](#第-1-步14下载二进制包 "第 1 步（1/4）：下载二进制包的直接链接")

从 Apache Doris [下载页面](https://doris.apache.org/zh-CN/download) 下载对应系统的二进制安装包，并解压到指定目录。

### 第 2 步（2/4）：配置系统环境[​](#第-2-步24配置系统环境 "第 2 步（2/4）：配置系统环境的直接链接")

**修改最大文件句柄数**（避免打开文件过多导致报错）：

```
vi /etc/security/limits.conf* soft nofile 1000000* hard nofile 1000000
```

**修改虚拟内存区域**：

```
cat >> /etc/sysctl.conf << EOFvm.max_map_count = 2000000EOFsysctl -p
```

### 第 3 步（3/4）：部署 FE[​](#第-3-步34部署-fe "第 3 步（3/4）：部署 FE的直接链接")

1.  **配置 FE**：编辑 `apache-doris/fe/conf/fe.conf`
    
    ```
    # 指定 Java 环境JAVA_HOME=/home/doris/jdk# 指定 FE 监听 IP（根据实际网段修改）priority_networks=127.0.0.1/32
    ```
    
2.  **启动 FE**：
    
    ```
    apache-doris/fe/bin/start_fe.sh --daemon
    ```
    
3.  **验证 FE 状态**：
    
    ```
    -- 目的：确认 FE 已启动并加入集群-- 期望：Join=true, Alive=true, IsMaster=truemysql -uroot -P9030 -h127.0.0.1 -e "show frontends;"
    ```
    

### 第 4 步（4/4）：部署 BE[​](#第-4-步44部署-be "第 4 步（4/4）：部署 BE的直接链接")

1.  **配置 BE**：编辑 `apache-doris/be/conf/be.conf`
    
    ```
    # 指定 BE 监听 IP（需与 FE 的 priority_networks 在同一网段）priority_networks=127.0.0.1/32
    ```
    
2.  **启动 BE**：
    
    ```
    apache-doris/be/bin/start_be.sh --daemon
    ```
    
3.  **注册 BE 到集群**：
    
    ```
    -- 目的：将 BE 节点加入集群管理ALTER SYSTEM ADD BACKEND "127.0.0.1:9050";
    ```
    
4.  **验证 BE 状态**：
    
    ```
    -- 目的：确认 BE 已注册且心跳正常-- 期望：Alive=truemysql -uroot -P9030 -h127.0.0.1 -e "show backends;"
    ```
    

* * *

## 运行首次查询[​](#运行首次查询 "运行首次查询的直接链接")

无论你使用 Docker 还是本地部署，集群启动后都可以执行以下步骤体验 Doris 的 SQL 功能。

### 连接集群[​](#连接集群 "连接集群的直接链接")

```
mysql -uroot -P9030 -h127.0.0.1
```

### 创建数据库和表[​](#创建数据库和表 "创建数据库和表的直接链接")

```
-- 目的：创建演示用数据库和表create database demo;use demo;create table mytable(    k1 TINYINT,    k2 DECIMAL(10, 2) DEFAULT "10.05",    k3 CHAR(10) COMMENT "string column",    k4 INT NOT NULL DEFAULT "1" COMMENT "int column")COMMENT "my first table"DISTRIBUTED BY HASH(k1) BUCKETS 1PROPERTIES ("replication_num" = "1");
```

### 导入测试数据[​](#导入测试数据 "导入测试数据的直接链接")

```
-- 目的：插入几条测试数据insert into mytable values(1, 0.14, 'a1', 20),(2, 1.04, 'b2', 21),(3, 3.14, 'c3', 22),(4, 4.35, 'd4', 23);
```

### 执行查询[​](#执行查询 "执行查询的直接链接")

```
-- 目的：验证数据导入成功-- 期望：看到 4 行数据select * from demo.mytable;
```

**输出示例：**

```
+------+------+------+------+| k1   | k2   | k3   | k4   |+------+------+------+------+|    1 | 0.14 | a1   |   20 ||    2 | 1.04 | b2   |   21 ||    3 | 3.14 | c3   |   22 ||    4 | 4.35 | d4   |   23 |+------+------+------+------+
```

* * *

## 常见问题[​](#常见问题 "常见问题的直接链接")

### Q: Docker 部署适合生产环境吗？[​](#q-docker-部署适合生产环境吗 "Q: Docker 部署适合生产环境吗？的直接链接")

不适合。Docker 部署仅用于本地开发和测试，数据在容器销毁时会丢失。生产环境请使用本地完整部署或多节点部署。

### Q: 如何在 Mac 上安装 Docker？[​](#q-如何在-mac-上安装-docker "Q: 如何在 Mac 上安装 Docker？的直接链接")

下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

### Q: Mac 安装 Docker Desktop 后提示 "Docker environment not detected"？[​](#q-mac-安装-docker-desktop-后提示-docker-environment-not-detected "Q: Mac 安装 Docker Desktop 后提示 \"Docker environment not detected\"？的直接链接")

创建符号链接：

```
sudo ln -s /Applications/Docker.app/Contents/Resources/bin/docker /usr/local/bin/docker
```

### Q: Mac 上 Docker 报 "error getting credentials"？[​](#q-mac-上-docker-报-error-getting-credentials "Q: Mac 上 Docker 报 \"error getting credentials\"？的直接链接")

删除 `~/.docker/config.json` 中的 `credsStore` 字段作为临时方案。注意：这会以明文存储凭据，仅限本地开发环境使用。

### Q: BE 节点添加后仍显示 "Dead"？[​](#q-be-节点添加后仍显示-dead "Q: BE 节点添加后仍显示 \"Dead\"？的直接链接")

检查 BE 的 `priority_networks` 是否与 FE 所在网段一致，并确认 BE 端口（9050/9060/8040/8060）未被防火墙拦截。

### Q: 在 WSL2 中本地部署，BE 始终无法加入集群？[​](#q-在-wsl2-中本地部署be-始终无法加入集群 "Q: 在 WSL2 中本地部署，BE 始终无法加入集群？的直接链接")

WSL2 的回环网络按发行版隔离，FE 与 BE 之间无法通过 `127.0.0.1` 互通，因此默认配置 `priority_networks=127.0.0.1/32` 在 WSL2 下会导致 BE 注册失败或心跳异常。

解决方法：通过 `ip addr show eth0` 查看 WSL 实际网卡所在网段（通常为 `172.16.0.0/12` 或 `172.x.x.x/20`），然后将 `fe/conf/fe.conf` 与 `be/conf/be.conf` 中的 `priority_networks` 同步修改为该网段，重启 FE、BE 后重新执行 `ALTER SYSTEM ADD BACKEND`。

### Q: 如何确认集群整体健康？[​](#q-如何确认集群整体健康 "Q: 如何确认集群整体健康？的直接链接")

执行 `SHOW FRONTENDS;` 和 `SHOW BACKENDS;`，确保所有节点的 `Alive` 列为 `true`。

* * *

## 下一步[​](#下一步 "下一步的直接链接")

*   \[数据建模指南\]：了解 Doris 的数据模型与分区策略(NEXT-TODO)
*   \[SQL 操作入门\]：学习数据导入、查询和更新(NEXT-TODO)
*   \[集群管理\]：掌握生产级集群运维(NEXT-TODO)

警告（仅针对本地部署）

以下内容**仅用于本地开发和测试**，**请勿用于生产环境**：

1.  **数据易丢失：** Docker 部署在容器销毁时会丢失数据；单副本实例不具备数据冗余能力。
2.  **单副本配置：** 示例中的建表语句均为单副本，生产环境应使用多副本存储以保证数据可靠性。

最后于 **2026年5月25日** 更新