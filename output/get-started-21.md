*   [English](/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/)
*   [中文](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/)
*   [日本語](/ja/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/)

最后于 **2026年5月17日** 更新

# 数据类型概览

## 数值类型[​](#数值类型 "数值类型的直接链接")

包括以下 4 种：

**1\. BOOLEAN 类型：**

两种取值，0 代表 false，1 代表 true。更多信息参考 [BOOLEAN 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/BOOLEAN/)。

**2\. 整数类型：**

都是有符号整数，xxINT 的差异是占用字节数和表示范围

*   TINYINT 占 1 字节，范围 \[-128, 127\], 更多信息参考 [TINYINT 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/TINYINT/)。
    
*   SMALLINT 占 2 字节，范围 \[-32768, 32767\], 更多信息参考 [SMALLINT 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/SMALLINT/)。
    
*   INT 占 4 字节，范围 \[-2147483648, 2147483647\], 更多信息参考 [INT 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/INT/)。
    
*   BIGINT 占 8 字节，范围 \[-9223372036854775808, 9223372036854775807\], 更多信息参考 [BIGINT 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/BIGINT/)。
    
*   LARGEINT 占 16 字节，范围 \[-2^127, 2^127 - 1\], 更多信息参考 [LARGEINT 文档](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/LARGEINT/)。
    

**3\. 浮点数类型：**

不精确的浮点数类型 FLOAT 和 DOUBLE，和常见编程语言中的 float 和 double 对应。更多信息参考 [FLOAT](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/FLOATING-POINT/)、[DOUBLE](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/FLOATING-POINT/) 文档。

**4\. 定点数类型：**

精确的定点数类型 DECIMAL，用于金融等精度要求严格准确的场景。更多信息参考 [DECIMAL](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/numeric/DECIMAL/) 文档。

## 日期类型[​](#日期类型 "日期类型的直接链接")

日期类型包括 DATE、TIME、DATETIME 和 TIMESTAMPTZ，DATE 类型只存储日期精确到天，DATETIME 类型存储日期和时间，可以精确到微秒。TIME 类型只存储时间，且**暂时不支持建表存储，只能在查询过程中使用**。TIMESTAMPTZ 是带时区信息的日期时间类型，存储时转换为 UTC 时间，查询时根据会话时区自动转换显示。

对日期类型进行计算，或将其转换为数字，请使用类似 [TIME\_TO\_SEC](/zh-CN/docs/4.x/sql-manual/basic-element/sql-functions/scalar-functions/date-time-functions/time-to-sec/), [DATE\_DIFF](/zh-CN/docs/4.x/sql-manual/basic-element/sql-functions/scalar-functions/date-time-functions/datediff/), [UNIX\_TIMESTAMP](/zh-CN/docs/4.x/sql-manual/basic-element/sql-functions/scalar-functions/date-time-functions/unix-timestamp/) 等函数，直接将其 CAST 为数字类型的结果不受保证。在未来的版本中，此类 CAST 行为将会被禁止。

更多信息参考 [DATE](/zh-CN/docs/4.x/sql-manual/basic-element/basic-element/sql-data-types/date-time/DATE/)、[TIME](/zh-CN/docs/4.x/sql-manual/basic-element/basic-element/sql-data-types/date-time/TIME/)、[DATETIME](/zh-CN/docs/4.x/sql-manual/basic-element/basic-element/sql-data-types/date-time/DATETIME/) 和 [TIMESTAMPTZ](/zh-CN/docs/4.x/sql-manual/basic-element/basic-element/sql-data-types/date-time/TIMESTAMPTZ/) 文档。

## 字符串类型[​](#字符串类型 "字符串类型的直接链接")

字符串类型支持定长和不定长，总共有以下 3 种：

1.  [CHAR(M)](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/string-type/CHAR/)：定长字符串，固定长度 M 字节，M 的范围是 \[1, 255\]。
    
2.  [VARCHAR(M)](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/string-type/VARCHAR/)：不定长字符串，M 是最大长度，M 的范围是 \[1, 65533\]。
    
3.  [STRING](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/string-type/STRING/)：不定长字符串，默认最长 1048576 字节（1MB），可调大到 2147483643 字节（2GB），BE 配置 string\_type\_length\_soft\_limit\_bytes。
    

## 二进制类型[​](#二进制类型 "二进制类型的直接链接")

1.  [VARBINARY](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/data-type-overview/binary-type/VARBINARY/)：变长二进制字节序列，M 为最大长度（单位：字节）。与 VARCHAR 类似，但按字节序存储与比较，不涉及字符集或排序规则，适合存储任意二进制数据（如文件片段、加密数据、压缩数据等）。自 4.0 起支持，当前不支持建表和存储，可以结合Catalog 映射其他数据库的BINARY到DORIS中使用。

## 半结构化类型[​](#半结构化类型 "半结构化类型的直接链接")

针对 JSON 半结构化数据，支持 3 类不同场景的半结构化数据类型：

1.  支持嵌套的固定 schema，适合分析的数据类型 **[ARRAY](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/semi-structured/ARRAY/)、 [MAP](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/semi-structured/MAP/) [STRUCT](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/semi-structured/STRUCT/)**：常用于用户行为和画像分析，湖仓一体查询数据湖中 Parquet 等格式的数据等场景。由于 schema 相对固定，没有动态 schema 推断的开销，写入和分析性能很高。
    
2.  支持嵌套的不固定 schema，适合分析的数据类型 **[VARIANT](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/semi-structured/VARIANT/)**：常用于 Log, Trace, IoT 等分析场景，schema 灵活可以写入任何合法的 JSON 数据，并自动展开成子列采用列式存储，存储压缩率高，聚合 过滤 排序等分析性能很好。
    
3.  支持嵌套的不固定 schema，适合点查的数据类型 **[JSON](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/semi-structured/JSON/)**：常用于高并发点查场景，schema 灵活可以写入任何合法的 JSON 数据，采用二进制格式存储，提取字段的性能比普通 JSON String 快 2 倍以上。
    

## 聚合类型[​](#聚合类型 "聚合类型的直接链接")

聚合类型存储聚合的结果或者中间状态，用于加速聚合查询，包括下面几种：

1.  [BITMAP](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/aggregate/BITMAP/)：用于精确去重，如 UV 统计，人群圈选等场景。配合 bitmap\_union、bitmap\_union\_count、bitmap\_hash、bitmap\_hash64 等 BITMAP 函数使用。
    
2.  [HLL](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/aggregate/HLL/)：用于近似去重，性能优于 COUNT DISTINCT。配合 hll\_union\_agg、hll\_raw\_agg、hll\_cardinality、hll\_hash 等 HLL 函数使用。
    
3.  [QUANTILE\_STATE](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/aggregate/QUANTILE-STATE/)：用于分位数近似计算，性能优于 PERCENTILE。配合 QUANTILE\_PERCENT、QUANTILE\_UNION、TO\_QUANTILE\_STATE 等函数使用。
    
4.  [AGG\_STATE](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/aggregate/AGG-STATE/)：用于聚合计算加速，配合 state/merge/union 聚合函数组合器使用。
    

## IP 类型[​](#ip-类型 "IP 类型的直接链接")

IP 类型以二进制形式存储 IP 地址，比用字符串存储更省空间查询速度更快，支持 2 种类型：

1.  [IPv4](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/ip/IPV4/)：以 4 字节二进制存储 IPv4 地址，配合 ipv4\_\* 系列函数使用。
    
2.  [IPv6](/zh-CN/docs/4.x/sql-manual/basic-element/sql-data-types/ip/IPV6/)：以 16 字节二进制存储 IPv6 地址，配合 ipv6\_\* 系列函数使用。