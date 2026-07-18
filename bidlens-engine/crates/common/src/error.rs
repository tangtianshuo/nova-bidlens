//! 统一错误类型定义

use thiserror::Error;

/// BidLens 统一错误类型
#[derive(Error, Debug)]
pub enum BidLensError {
    /// 解析错误
    #[error("Parse error: {0}")]
    Parse(String),

    /// 差异计算错误
    #[error("Diff error: {0}")]
    Diff(String),

    /// IO 错误
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    /// JSON 序列化/反序列化错误
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// 文档未找到
    #[error("Document not found: {0}")]
    DocumentNotFound(String),

    /// 输入无效
    #[error("Invalid input: {0}")]
    InvalidInput(String),

    /// 超时错误
    #[error("Timeout: {0}")]
    Timeout(String),

    /// 内部错误
    #[error("Internal error: {0}")]
    Internal(String),
}

/// 便捷类型别名
pub type Result<T> = std::result::Result<T, BidLensError>;

impl BidLensError {
    /// 创建解析错误
    pub fn parse(msg: impl Into<String>) -> Self {
        Self::Parse(msg.into())
    }

    /// 创建差异计算错误
    pub fn diff(msg: impl Into<String>) -> Self {
        Self::Diff(msg.into())
    }

    /// 创建输入无效错误
    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::InvalidInput(msg.into())
    }

    /// 创建内部错误
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}
