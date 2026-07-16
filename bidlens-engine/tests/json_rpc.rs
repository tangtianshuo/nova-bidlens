use std::{
    io::{BufRead, BufReader, Write},
    process::{Command, Stdio},
};

#[test]
fn responds_to_ping() {
    let mut child = Command::new(env!("CARGO_BIN_EXE_bidlens-engine"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("spawn bidlens-engine");

    {
        let mut stdin = child.stdin.take().expect("child stdin");
        writeln!(stdin, r#"{{"id":"ping-1","method":"ping","params":{{}}}}"#)
            .expect("write ping request");
    }

    let stdout = child.stdout.take().expect("child stdout");
    let mut line = String::new();
    BufReader::new(stdout)
        .read_line(&mut line)
        .expect("read ping response");

    let status = child.wait().expect("wait for child");
    assert!(status.success());
    assert!(!line.is_empty(), "expected one JSON-RPC response line");

    let response: serde_json::Value = serde_json::from_str(&line).expect("parse JSON-RPC response");
    assert_eq!(response["id"], "ping-1");
    assert_eq!(response["result"]["pong"], true);
    assert_eq!(response["result"]["version"], "0.1.0");
}
