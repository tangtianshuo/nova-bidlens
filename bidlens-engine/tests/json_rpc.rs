use std::{
    io::{BufRead, BufReader, Write},
    process::{Child, ChildStdin, ChildStdout, Command, Stdio},
};

struct EngineProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

fn spawn_engine() -> EngineProcess {
    let mut child = Command::new(env!("CARGO_BIN_EXE_bidlens-engine"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("spawn bidlens-engine");

    let stdin = child.stdin.take().expect("child stdin");
    let stdout = BufReader::new(child.stdout.take().expect("child stdout"));

    EngineProcess {
        child,
        stdin,
        stdout,
    }
}

impl EngineProcess {
    fn write(&mut self, request: &str) {
        writeln!(self.stdin, "{request}").expect("write request");
    }

    fn read(&mut self) -> serde_json::Value {
        let mut line = String::new();
        self.stdout.read_line(&mut line).expect("read response");
        serde_json::from_str(&line).expect("parse JSON-RPC response")
    }

    fn send(&mut self, request: &str) -> serde_json::Value {
        self.write(request);
        self.read()
    }

    fn shutdown(&mut self) {
        self.send(r#"{"id":"s1","method":"shutdown","params":{}}"#);
    }

    fn wait(&mut self) -> std::process::ExitStatus {
        self.child.wait().expect("wait for child")
    }
}

fn document(id: &str, texts: &[String]) -> serde_json::Value {
    let blocks: Vec<_> = texts
        .iter()
        .enumerate()
        .map(|(index, text)| {
            serde_json::json!({
                "type": "paragraph",
                "id": format!("{id}-p-{index}"),
                "runs": [{ "id": format!("{id}-r-{index}"), "text": text, "format": null }],
                "page_start": null,
                "page_end": null,
                "paragraph_format": null
            })
        })
        .collect();
    serde_json::json!({
        "id": id,
        "filename": format!("{id}.docx"),
        "sha256": id,
        "page_count": null,
        "word_count": texts.len(),
        "parser_version": "test",
        "blocks": blocks,
        "comments": [],
        "revisions": []
    })
}

#[test]
fn responds_to_ping() {
    let mut eng = spawn_engine();
    let response = eng.send(r#"{"id":"ping-1","method":"ping","params":{}}"#);

    assert_eq!(response["id"], "ping-1");
    assert_eq!(response["result"]["pong"], true);
    assert!(response["result"]["engine_version"].is_string());
    assert!(response["result"]["protocol_version"].is_string());
    assert!(response["result"]["capabilities"].is_array());

    eng.shutdown();
    assert!(eng.wait().success());
}

#[test]
fn responds_to_handshake() {
    let mut eng = spawn_engine();
    let response = eng.send(r#"{"id":"hs-1","method":"engine.handshake","params":{}}"#);

    assert_eq!(response["id"], "hs-1");
    assert!(response["result"]["engine_version"].is_string());
    assert_eq!(response["result"]["protocol_version"], "1.0");
    let caps = response["result"]["capabilities"].as_array().unwrap();
    assert!(caps.contains(&serde_json::Value::String("compare".to_string())));

    eng.shutdown();
    assert!(eng.wait().success());
}

#[test]
fn rejects_unknown_method() {
    let mut eng = spawn_engine();
    let response = eng.send(r#"{"id":"bad-1","method":"nonexistent","params":{}}"#);

    assert_eq!(response["id"], "bad-1");
    assert_eq!(response["error"]["code"], -32601);

    eng.shutdown();
    assert!(eng.wait().success());
}

#[test]
fn shutdown_exits_cleanly() {
    let mut eng = spawn_engine();
    let response = eng.send(r#"{"id":"s1","method":"shutdown","params":{}}"#);

    assert_eq!(response["id"], "s1");
    assert_eq!(response["result"]["shutting_down"], true);

    let status = eng.wait();
    assert!(status.success());
}

#[test]
fn compare_returns_diff_envelope_and_progress() {
    let mut eng = spawn_engine();
    let left = document("a", &["投标人应提供营业执照".to_string()]);
    let right = document("b", &["投标人须提供营业执照".to_string()]);
    eng.write(
        &serde_json::json!({
            "id": "compare-1",
            "method": "compare",
            "params": { "doc_a": left, "doc_b": right, "options": { "similarity_threshold": 0.45 } }
        })
        .to_string(),
    );

    let mut saw_progress = false;
    loop {
        let message = eng.read();
        if message["method"] == "compare.progress" {
            saw_progress = true;
        }
        if message["id"] == "compare-1" {
            assert!(
                message["result"]["diff"]["items"]
                    .as_array()
                    .is_some_and(|items| !items.is_empty())
            );
            break;
        }
    }
    assert!(saw_progress);
    eng.shutdown();
    assert!(eng.wait().success());
}

#[test]
fn ping_and_cancel_remain_responsive_during_compare() {
    let mut eng = spawn_engine();
    let texts: Vec<_> = (0..2_000)
        .map(|index| format!("条款 {index} 测试内容"))
        .collect();
    let left = document("large-a", &texts);
    let right = document("large-b", &texts);
    eng.write(
        &serde_json::json!({
            "id": "compare-long",
            "method": "compare",
            "params": { "doc_a": left, "doc_b": right, "options": { "similarity_threshold": 0.45 } }
        })
        .to_string(),
    );
    eng.write(r#"{"id":"ping-live","method":"ping","params":{}}"#);
    eng.write(r#"{"id":"cancel-live","method":"compare.cancel","params":{}}"#);

    let mut ping_seen = false;
    let mut cancel_seen = false;
    let mut compare_seen = false;
    while !(ping_seen && cancel_seen && compare_seen) {
        let message = eng.read();
        match message["id"].as_str() {
            Some("ping-live") => ping_seen = message["result"]["pong"] == true,
            Some("cancel-live") => cancel_seen = message["result"]["cancelled"] == true,
            Some("compare-long") => {
                compare_seen = true;
                assert_eq!(message["error"]["code"], -32002);
            }
            _ => {}
        }
    }

    eng.shutdown();
    assert!(eng.wait().success());
}
