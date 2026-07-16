use anyhow::Result;
use diff_engine::{CompareOptions, compare_documents};
use document_ast::DocumentAst;
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{self, AsyncBufReadExt, AsyncWriteExt, BufReader};

#[derive(Debug, Deserialize)]
struct RpcRequest {
    id: String,
    method: String,
    params: Value,
}

#[derive(Debug, Deserialize)]
struct CompareParams {
    doc_a: DocumentAst,
    doc_b: DocumentAst,
    options: Option<CompareOptions>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let mut lines = BufReader::new(io::stdin()).lines();
    let mut stdout = io::stdout();

    while let Some(line) = lines.next_line().await? {
        let request: RpcRequest = serde_json::from_str(&line)?;
        let response = match request.method.as_str() {
            "ping" => json!({ "id": request.id, "result": { "pong": true, "version": "0.1.0" } }),
            "compare" => {
                let params: CompareParams = serde_json::from_value(request.params)?;
                let result = compare_documents(
                    &params.doc_a,
                    &params.doc_b,
                    params.options.unwrap_or_default(),
                );
                json!({ "id": request.id, "result": result })
            }
            method => {
                json!({ "id": request.id, "error": { "code": -32601, "message": format!("unknown method: {method}") } })
            }
        };

        stdout
            .write_all(serde_json::to_string(&response)?.as_bytes())
            .await?;
        stdout.write_all(b"\n").await?;
        stdout.flush().await?;
    }

    Ok(())
}
