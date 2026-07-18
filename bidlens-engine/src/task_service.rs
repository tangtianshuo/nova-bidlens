//! Transport-neutral task service.
//! Contains comparison logic independent of stdio/HTTP transport.

use diff_engine::{CompareOptions, DiffAst, compare_documents_cancellable};
use document_ast::DocumentAst;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::watch;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRequest {
    pub doc_a: DocumentAst,
    pub doc_b: DocumentAst,
    pub options: Option<CompareOptions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskPhase {
    Comparing,
    Finalizing,
    Complete,
    Cancelled,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskProgress {
    pub phase: TaskPhase,
    pub message: String,
    pub current: Option<u64>,
    pub total: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskResult {
    pub diff: DiffAst,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineInfo {
    pub engine_version: String,
    pub protocol_version: String,
    pub capabilities: Vec<String>,
}

pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const PROTOCOL_VERSION: &str = "1.0";

pub fn engine_info() -> EngineInfo {
    EngineInfo {
        engine_version: ENGINE_VERSION.to_string(),
        protocol_version: PROTOCOL_VERSION.to_string(),
        capabilities: vec!["compare".to_string(), "ping".to_string()],
    }
}

/// Run a comparison task. Returns the result or an error string.
/// The progress callback is called with phase updates.
pub fn run_compare<F>(
    request: TaskRequest,
    cancel_token: &CancellationToken,
    mut on_progress: F,
) -> Result<TaskResult, String>
where
    F: FnMut(TaskProgress),
{
    on_progress(TaskProgress {
        phase: TaskPhase::Comparing,
        message: "正在比对文档...".to_string(),
        current: None,
        total: None,
    });

    let start = std::time::Instant::now();

    let options = request.options.unwrap_or_default();

    if cancel_token.is_cancelled() {
        return Err("任务已取消".to_string());
    }

    let diff = compare_documents_cancellable(&request.doc_a, &request.doc_b, options, || {
        cancel_token.is_cancelled()
    })
    .ok_or_else(|| "任务已取消".to_string())?;

    if cancel_token.is_cancelled() {
        return Err("任务已取消".to_string());
    }

    on_progress(TaskProgress {
        phase: TaskPhase::Finalizing,
        message: "正在整理结果...".to_string(),
        current: None,
        total: None,
    });

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(TaskResult { diff, duration_ms })
}

/// Simple cancellation token using a shared watch channel.
#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<watch::Receiver<bool>>,
}

impl CancellationToken {
    pub fn new() -> (Self, watch::Sender<bool>) {
        let (tx, rx) = watch::channel(false);
        (
            Self {
                cancelled: Arc::new(rx),
            },
            tx,
        )
    }

    pub fn is_cancelled(&self) -> bool {
        *self.cancelled.borrow()
    }
}
