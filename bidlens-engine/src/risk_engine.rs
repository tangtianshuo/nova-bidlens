//! Risk engine: JSON-RPC skeleton for the similarity risk review pipeline.

use review_core::{
    AnalysisPhase, ProjectStatus, RiskPreset,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, watch};

// ============================================================================
// Request / Response Types (matching packages/shared/src/ipc.ts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskFileInput {
    pub path: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskProjectRequest {
    pub name: String,
    pub submissions: Vec<RiskFileInput>,
    pub baseline: Option<RiskFileInput>,
    pub preset: RiskPreset,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectResponse {
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskProgress {
    pub project_id: String,
    pub status: ProjectStatus,
    pub phase: Option<AnalysisPhase>,
    pub stage_label: String,
    pub current: Option<u64>,
    pub total: Option<u64>,
    pub elapsed_ms: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskProjectResult {
    pub project_id: String,
    pub status: ProjectStatus,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStatusResponse {
    pub project_id: String,
    pub status: ProjectStatus,
    pub phase: Option<AnalysisPhase>,
    pub elapsed_ms: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelProjectResponse {
    pub project_id: String,
    pub cancelled: bool,
}

// ============================================================================
// Structured Error (matching StructuredRiskError in ipc.ts)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredRiskError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retryable: bool,
}

impl std::fmt::Display for StructuredRiskError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for StructuredRiskError {}

// ============================================================================
// Internal Project State
// ============================================================================

struct ProjectState {
    request: RiskProjectRequest,
    status: ProjectStatus,
    phase: Option<AnalysisPhase>,
    warnings: Vec<String>,
    cancel_sender: watch::Sender<bool>,
    started_at: std::time::Instant,
}

// ============================================================================
// RiskEngine
// ============================================================================

/// The risk engine manages risk review projects and coordinates the analysis pipeline.
pub struct RiskEngine {
    projects: Arc<RwLock<HashMap<String, ProjectState>>>,
}

impl RiskEngine {
    pub fn new() -> Self {
        Self {
            projects: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a new risk project. Validates input and returns a project_id.
    pub async fn create_project(
        &self,
        request: RiskProjectRequest,
    ) -> Result<CreateProjectResponse, StructuredRiskError> {
        // Validate: at least 2 submissions
        if request.submissions.len() < 2 {
            return Err(StructuredRiskError {
                code: "INVALID_INPUT".to_string(),
                message: "至少需要2个投标文件".to_string(),
                details: Some(serde_json::json!({
                    "minSubmissions": 2,
                    "actual": request.submissions.len()
                })),
                retryable: false,
            });
        }

        // Validate: max 8 submissions
        if request.submissions.len() > 8 {
            return Err(StructuredRiskError {
                code: "INVALID_INPUT".to_string(),
                message: "最多支持8个投标文件".to_string(),
                details: Some(serde_json::json!({
                    "maxSubmissions": 8,
                    "actual": request.submissions.len()
                })),
                retryable: false,
            });
        }

        // Validate: files exist
        for sub in &request.submissions {
            if !std::path::Path::new(&sub.path).exists() {
                return Err(StructuredRiskError {
                    code: "FILE_NOT_FOUND".to_string(),
                    message: format!("文件不存在: {}", sub.path),
                    details: Some(serde_json::json!({ "path": sub.path })),
                    retryable: false,
                });
            }
        }

        if let Some(ref baseline) = request.baseline {
            if !std::path::Path::new(&baseline.path).exists() {
                return Err(StructuredRiskError {
                    code: "FILE_NOT_FOUND".to_string(),
                    message: format!("基线文件不存在: {}", baseline.path),
                    details: Some(serde_json::json!({ "path": baseline.path })),
                    retryable: false,
                });
            }
        }

        let project_id = uuid::Uuid::new_v4().to_string();
        let (cancel_tx, _cancel_rx) = watch::channel(false);

        let state = ProjectState {
            request,
            status: ProjectStatus::Draft,
            phase: None,
            warnings: Vec::new(),
            cancel_sender: cancel_tx,
            started_at: std::time::Instant::now(),
        };

        let mut projects = self.projects.write().await;
        projects.insert(project_id.clone(), state);

        Ok(CreateProjectResponse { project_id })
    }

    /// Cancel a running project.
    pub async fn cancel_project(
        &self,
        project_id: &str,
    ) -> Result<CancelProjectResponse, StructuredRiskError> {
        let mut projects = self.projects.write().await;
        let state = projects
            .get_mut(project_id)
            .ok_or_else(|| StructuredRiskError {
                code: "PROJECT_NOT_FOUND".to_string(),
                message: format!("项目不存在: {project_id}"),
                details: None,
                retryable: false,
            })?;

        let _ = state.cancel_sender.send(true);
        state.status = ProjectStatus::Cancelled;

        Ok(CancelProjectResponse {
            project_id: project_id.to_string(),
            cancelled: true,
        })
    }

    /// Get current project status.
    pub async fn get_project(
        &self,
        project_id: &str,
    ) -> Result<ProjectStatusResponse, StructuredRiskError> {
        let projects = self.projects.read().await;
        let state = projects
            .get(project_id)
            .ok_or_else(|| StructuredRiskError {
                code: "PROJECT_NOT_FOUND".to_string(),
                message: format!("项目不存在: {project_id}"),
                details: None,
                retryable: false,
            })?;

        Ok(ProjectStatusResponse {
            project_id: project_id.to_string(),
            status: state.status,
            phase: state.phase,
            elapsed_ms: state.started_at.elapsed().as_millis() as u64,
            warnings: state.warnings.clone(),
        })
    }

    /// Run the analysis pipeline for a project.
    /// Emits progress events via the callback.
    pub async fn run_analysis<F>(
        &self,
        project_id: &str,
        mut on_progress: F,
    ) -> Result<RiskProjectResult, StructuredRiskError>
    where
        F: FnMut(RiskProgress),
    {
        let phases: &[(AnalysisPhase, &str)] = &[
            (AnalysisPhase::Validating, "正在验证文件..."),
            (AnalysisPhase::Parsing, "正在解析文档..."),
            (AnalysisPhase::ExtractingNodes, "正在提取节点..."),
            (AnalysisPhase::ExtractingEntities, "正在提取实体..."),
            (AnalysisPhase::FilteringTenderContent, "正在过滤招标内容..."),
            (AnalysisPhase::RecallingCandidates, "正在召回候选..."),
            (AnalysisPhase::Detecting, "正在检测..."),
            (AnalysisPhase::Aggregating, "正在聚合结果..."),
            (AnalysisPhase::Persisting, "正在持久化..."),
            (AnalysisPhase::Completed, "分析完成"),
        ];

        let (project_id_owned, request, cancel_rx, started_at) = {
            let mut projects = self.projects.write().await;
            let state = projects
                .get_mut(project_id)
                .ok_or_else(|| StructuredRiskError {
                    code: "PROJECT_NOT_FOUND".to_string(),
                    message: format!("项目不存在: {project_id}"),
                    details: None,
                    retryable: false,
                })?;
            state.status = ProjectStatus::Running;
            (
                project_id.to_string(),
                state.request.clone(),
                state.cancel_sender.subscribe(),
                state.started_at,
            )
        };

        let cancel_rx = Arc::new(tokio::sync::Mutex::new(cancel_rx));

        for (i, (phase, label)) in phases.iter().enumerate() {
            // Check cancellation
            {
                let rx = cancel_rx.lock().await;
                if *rx.borrow() {
                    let mut projects = self.projects.write().await;
                    if let Some(state) = projects.get_mut(&project_id_owned) {
                        state.status = ProjectStatus::Cancelled;
                    }
                    return Err(StructuredRiskError {
                        code: "CANCELLED".to_string(),
                        message: "任务已取消".to_string(),
                        details: None,
                        retryable: false,
                    });
                }
            }

            // Update state
            {
                let mut projects = self.projects.write().await;
                if let Some(state) = projects.get_mut(&project_id_owned) {
                    state.phase = Some(*phase);
                }
            }

            // Emit progress
            on_progress(RiskProgress {
                project_id: project_id_owned.clone(),
                status: ProjectStatus::Running,
                phase: Some(*phase),
                stage_label: label.to_string(),
                current: Some(i as u64 + 1),
                total: Some(phases.len() as u64),
                elapsed_ms: started_at.elapsed().as_millis() as u64,
                warnings: Vec::new(),
            });

            // Simulate work (placeholder — real implementation will call detectors)
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }

        // Mark complete
        {
            let mut projects = self.projects.write().await;
            if let Some(state) = projects.get_mut(&project_id_owned) {
                state.status = ProjectStatus::Ready;
                state.phase = Some(AnalysisPhase::Completed);
            }
        }

        Ok(RiskProjectResult {
            project_id: project_id_owned,
            status: ProjectStatus::Ready,
            warnings: request
                .submissions
                .iter()
                .filter(|s| s.name.is_none())
                .map(|_| "文件缺少自定义名称，已使用文件名".to_string())
                .collect(),
        })
    }
}

impl Default for RiskEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn risk_progress_serde_camel_case() {
        let progress = RiskProgress {
            project_id: "p-1".to_string(),
            status: ProjectStatus::Running,
            phase: Some(AnalysisPhase::Parsing),
            stage_label: "解析中".to_string(),
            current: Some(2),
            total: Some(10),
            elapsed_ms: 1500,
            warnings: vec![],
        };
        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"stageLabel\""));
        assert!(json.contains("\"elapsedMs\""));
        assert!(json.contains("\"phase\""));
    }

    #[test]
    fn structured_error_serde() {
        let err = StructuredRiskError {
            code: "INVALID_INPUT".to_string(),
            message: "至少需要2个投标文件".to_string(),
            details: Some(serde_json::json!({"min": 2})),
            retryable: false,
        };
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("\"code\""));
        assert!(json.contains("\"retryable\""));
        let back: StructuredRiskError = serde_json::from_str(&json).unwrap();
        assert_eq!(back.code, "INVALID_INPUT");
    }

    #[tokio::test]
    async fn create_project_validates_minimum_submissions() {
        let engine = RiskEngine::new();
        let result = engine
            .create_project(RiskProjectRequest {
                name: "test".to_string(),
                submissions: vec![RiskFileInput {
                    path: "/tmp/a.pdf".to_string(),
                    name: None,
                }],
                baseline: None,
                preset: RiskPreset::Standard,
            })
            .await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "INVALID_INPUT");
    }

    #[tokio::test]
    async fn create_project_validates_file_existence() {
        let engine = RiskEngine::new();
        let result = engine
            .create_project(RiskProjectRequest {
                name: "test".to_string(),
                submissions: vec![
                    RiskFileInput {
                        path: "/nonexistent/a.pdf".to_string(),
                        name: None,
                    },
                    RiskFileInput {
                        path: "/nonexistent/b.pdf".to_string(),
                        name: None,
                    },
                ],
                baseline: None,
                preset: RiskPreset::Standard,
            })
            .await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "FILE_NOT_FOUND");
    }

    #[tokio::test]
    async fn get_project_not_found() {
        let engine = RiskEngine::new();
        let result = engine.get_project("nonexistent").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "PROJECT_NOT_FOUND");
    }

    #[tokio::test]
    async fn cancel_project_not_found() {
        let engine = RiskEngine::new();
        let result = engine.cancel_project("nonexistent").await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, "PROJECT_NOT_FOUND");
    }
}
