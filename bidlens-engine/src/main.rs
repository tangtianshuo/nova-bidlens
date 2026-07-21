mod risk_engine;
mod task_service;

use anyhow::Result;
use risk_engine::{RiskEngine, RiskProjectRequest};
use serde::Deserialize;
use serde_json::{Value, json};
use std::sync::Arc;
use task_service::{CancellationToken, TaskProgress, TaskResult, engine_info, run_compare};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::{mpsc, watch};

#[derive(Debug, Deserialize)]
struct RpcRequest {
    id: String,
    method: String,
    params: Option<Value>,
}

enum TaskEvent {
    Progress {
        request_id: String,
        progress: TaskProgress,
    },
    Completed {
        request_id: String,
        result: Result<TaskResult, String>,
    },
    RiskProgress {
        progress: risk_engine::RiskProgress,
    },
    RiskCompleted {
        request_id: String,
        result: Result<risk_engine::RiskProjectResult, String>,
    },
}

struct ActiveTask {
    request_id: String,
    cancel: watch::Sender<bool>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut lines = BufReader::new(io::stdin()).lines();
    let mut stdout = io::stdout();
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<TaskEvent>();
    let mut active_task: Option<ActiveTask> = None;
    let risk_engine = Arc::new(RiskEngine::new());

    loop {
        tokio::select! {
            line = lines.next_line() => {
                let Some(line) = line? else { break };
                let request: RpcRequest = match serde_json::from_str(&line) {
                    Ok(request) => request,
                    Err(error) => {
                        write_line(&mut stdout, &json!({
                            "id": null,
                            "error": { "code": -32700, "message": format!("parse error: {error}") }
                        })).await?;
                        continue;
                    }
                };

                match request.method.as_str() {
                    "ping" | "engine.handshake" => {
                        let info = engine_info();
                        let mut result = json!({
                            "engine_version": info.engine_version,
                            "protocol_version": info.protocol_version,
                            "capabilities": info.capabilities
                        });
                        if request.method == "ping" {
                            result["pong"] = json!(true);
                        }
                        write_result(&mut stdout, &request.id, result).await?;
                    }
                    "compare" => {
                        if active_task.is_some() {
                            write_error(&mut stdout, &request.id, -32001, "ENGINE_BUSY: 已有比对任务正在运行").await?;
                            continue;
                        }

                        let params = match request.params.map(serde_json::from_value).transpose() {
                            Ok(Some(params)) => params,
                            Ok(None) => {
                                write_error(&mut stdout, &request.id, -32602, "缺少参数").await?;
                                continue;
                            }
                            Err(error) => {
                                write_error(&mut stdout, &request.id, -32602, &format!("参数错误: {error}")).await?;
                                continue;
                            }
                        };

                        let (token, cancel) = CancellationToken::new();
                        let request_id = request.id.clone();
                        let worker_request_id = request_id.clone();
                        let completion_request_id = request_id.clone();
                        let worker_tx = event_tx.clone();
                        let join = tokio::task::spawn_blocking(move || {
                            let progress_tx = worker_tx.clone();
                            let progress_request_id = worker_request_id.clone();
                            run_compare(params, &token, move |progress| {
                                let _ = progress_tx.send(TaskEvent::Progress {
                                    request_id: progress_request_id.clone(),
                                    progress,
                                });
                            })
                        });
                        let completion_tx = event_tx.clone();
                        tokio::spawn(async move {
                            let result = match join.await {
                                Ok(result) => result,
                                Err(error) => Err(format!("任务异常: {error}")),
                            };
                            let _ = completion_tx.send(TaskEvent::Completed {
                                request_id: completion_request_id,
                                result,
                            });
                        });
                        active_task = Some(ActiveTask { request_id, cancel });
                    }
                    "compare.cancel" => {
                        let cancelled = if let Some(task) = &active_task {
                            let _ = task.cancel.send(true);
                            true
                        } else {
                            false
                        };
                        write_result(&mut stdout, &request.id, json!({ "cancelled": cancelled })).await?;
                    }
                    "risk.createProject" => {
                        let params: RiskProjectRequest = match request.params.map(serde_json::from_value).transpose() {
                            Ok(Some(params)) => params,
                            Ok(None) => {
                                write_error(&mut stdout, &request.id, -32602, "缺少参数").await?;
                                continue;
                            }
                            Err(error) => {
                                write_error(&mut stdout, &request.id, -32602, &format!("参数错误: {error}")).await?;
                                continue;
                            }
                        };
                        let engine = risk_engine.clone();
                        let request_id = request.id.clone();
                        let worker_tx = event_tx.clone();
                        let project_id = match engine.create_project(params).await {
                            Ok(resp) => resp.project_id.clone(),
                            Err(err) => {
                                write_error(&mut stdout, &request.id, -32010, &err.message).await?;
                                continue;
                            }
                        };
                        // Run analysis in background
                        let engine_clone = engine.clone();
                        let pid = project_id.clone();
                        let completion_tx = event_tx.clone();
                        tokio::spawn(async move {
                            let progress_tx = worker_tx.clone();
                            let result = engine_clone.run_analysis(&pid, move |progress| {
                                let _ = progress_tx.send(TaskEvent::RiskProgress {
                                    progress,
                                });
                            }).await;
                            let _ = completion_tx.send(TaskEvent::RiskCompleted {
                                request_id: request_id.clone(),
                                result: result.map_err(|e| e.message),
                            });
                        });
                        write_result(&mut stdout, &request.id, json!({ "projectId": project_id })).await?;
                    }
                    "risk.cancelProject" => {
                        let project_id: String = match request.params.and_then(|p| p.get("projectId").cloned()).map(serde_json::from_value).transpose() {
                            Ok(Some(id)) => id,
                            _ => {
                                write_error(&mut stdout, &request.id, -32602, "缺少 projectId").await?;
                                continue;
                            }
                        };
                        let engine = risk_engine.clone();
                        match engine.cancel_project(&project_id).await {
                            Ok(resp) => write_result(&mut stdout, &request.id, serde_json::to_value(&resp).unwrap()).await?,
                            Err(err) => write_error(&mut stdout, &request.id, -32010, &err.message).await?,
                        }
                    }
                    "risk.getProject" => {
                        let project_id: String = match request.params.and_then(|p| p.get("projectId").cloned()).map(serde_json::from_value).transpose() {
                            Ok(Some(id)) => id,
                            _ => {
                                write_error(&mut stdout, &request.id, -32602, "缺少 projectId").await?;
                                continue;
                            }
                        };
                        let engine = risk_engine.clone();
                        match engine.get_project(&project_id).await {
                            Ok(resp) => write_result(&mut stdout, &request.id, serde_json::to_value(&resp).unwrap()).await?,
                            Err(err) => write_error(&mut stdout, &request.id, -32010, &err.message).await?,
                        }
                    }
                    "shutdown" => {
                        if let Some(task) = &active_task {
                            let _ = task.cancel.send(true);
                        }
                        write_result(&mut stdout, &request.id, json!({ "shutting_down": true })).await?;
                        break;
                    }
                    method => {
                        write_error(&mut stdout, &request.id, -32601, &format!("未知方法: {method}")).await?;
                    }
                }
            }
            event = event_rx.recv() => {
                let Some(event) = event else { break };
                match event {
                    TaskEvent::Progress { request_id, progress } => {
                        write_line(&mut stdout, &json!({
                            "method": "compare.progress",
                            "params": {
                                "task_id": request_id,
                                "phase": progress.phase,
                                "message": progress.message,
                                "current": progress.current,
                                "total": progress.total
                            }
                        })).await?;
                    }
                    TaskEvent::Completed { request_id, result } => {
                        if active_task.as_ref().is_some_and(|task| task.request_id == request_id) {
                            active_task = None;
                        }
                        match result {
                            Ok(task_result) => {
                                write_result(&mut stdout, &request_id, json!({
                                    "diff": task_result.diff,
                                    "duration_ms": task_result.duration_ms
                                })).await?;
                            }
                            Err(message) if message.contains("取消") => {
                                write_error(&mut stdout, &request_id, -32002, &message).await?;
                            }
                            Err(message) => {
                                write_error(&mut stdout, &request_id, -32000, &message).await?;
                            }
                        }
                    }
                    TaskEvent::RiskProgress { progress } => {
                        write_line(&mut stdout, &json!({
                            "method": "risk.progress",
                            "params": progress
                        })).await?;
                    }
                    TaskEvent::RiskCompleted { request_id, result } => {
                        match result {
                            Ok(project_result) => {
                                write_result(&mut stdout, &request_id, serde_json::to_value(&project_result).unwrap()).await?;
                            }
                            Err(message) if message.contains("取消") => {
                                write_error(&mut stdout, &request_id, -32002, &message).await?;
                            }
                            Err(message) => {
                                write_error(&mut stdout, &request_id, -32000, &message).await?;
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

async fn write_result(stdout: &mut io::Stdout, id: &str, result: Value) -> Result<()> {
    write_line(stdout, &json!({ "id": id, "result": result })).await
}

async fn write_error(stdout: &mut io::Stdout, id: &str, code: i32, message: &str) -> Result<()> {
    write_line(
        stdout,
        &json!({ "id": id, "error": { "code": code, "message": message } }),
    )
    .await
}

async fn write_line(stdout: &mut io::Stdout, value: &Value) -> Result<()> {
    stdout
        .write_all(serde_json::to_string(value)?.as_bytes())
        .await?;
    stdout.write_all(b"\n").await?;
    stdout.flush().await?;
    Ok(())
}
