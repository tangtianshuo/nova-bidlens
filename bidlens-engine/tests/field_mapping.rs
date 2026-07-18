use serde_json::Value;
use std::fs;

/// Canonical JSON fixture for TS/Rust field mapping verification.
/// This test ensures that Rust serde field names match the canonical fixture
/// produced by the TypeScript side.
const FIXTURE_PATH: &str = "../packages/shared/src/__fixtures__/canonical-ast.json";

#[test]
fn canonical_fixture_document_ast_roundtrip() {
    let fixture = fs::read_to_string(FIXTURE_PATH)
        .expect("Failed to read canonical fixture. Run from bidlens-engine/ directory.");
    let value: Value = serde_json::from_str(&fixture).expect("Invalid JSON in fixture");

    // Extract documentAst and verify it deserializes as Rust DocumentAst
    let doc_json = &value["documentAst"];
    let doc: document_ast::DocumentAst =
        serde_json::from_value(doc_json.clone()).expect("Failed to deserialize documentAst");

    assert_eq!(doc.id, "doc-a-001");
    assert_eq!(doc.filename, "基准版.docx");
    assert_eq!(doc.page_count, Some(3));
    assert_eq!(doc.word_count, 1500);
    assert_eq!(doc.parser_version, "0.2.2");
    assert_eq!(doc.blocks.len(), 3);

    // Verify paragraph
    if let document_ast::BlockNode::Paragraph(p) = &doc.blocks[0] {
        assert_eq!(p.id, "p-001");
        assert_eq!(p.plain_text(), "投标人应提供有效的营业执照副本");
        assert_eq!(p.page_start, Some(1));
        assert_eq!(p.runs.len(), 1);
        assert_eq!(p.runs[0].text, "投标人应提供有效的营业执照副本");
    } else {
        panic!("Expected paragraph block");
    }

    // Verify table
    if let document_ast::BlockNode::Table(t) = &doc.blocks[2] {
        assert_eq!(t.id, "t-001");
        assert_eq!(t.rows.len(), 2);
        // TableCell uses content: Vec<BlockNode>, not text
        assert_eq!(t.rows[0].row_type, document_ast::RowType::Header);
    } else {
        panic!("Expected table block");
    }

    // Verify comments
    assert_eq!(doc.comments.len(), 1);
    assert_eq!(doc.comments[0].author, "张三");
    assert_eq!(doc.comments[0].range.start_node_id, "p-001");

    // Verify revisions
    assert_eq!(doc.revisions.len(), 1);
    assert_eq!(
        doc.revisions[0].revision_type,
        document_ast::RevisionType::Insert
    );
    assert_eq!(doc.revisions[0].content.text, "有效");

    // Re-serialize and verify field names are snake_case
    let reserialized = serde_json::to_value(&doc).expect("Failed to re-serialize");
    assert!(
        reserialized.get("page_count").is_some(),
        "page_count must be snake_case"
    );
    assert!(
        reserialized.get("word_count").is_some(),
        "word_count must be snake_case"
    );
    assert!(
        reserialized.get("parser_version").is_some(),
        "parser_version must be snake_case"
    );
    assert!(
        reserialized.get("page_start").is_none(),
        "paragraph fields should be in nested object"
    );
}

#[test]
fn canonical_fixture_diff_ast_roundtrip() {
    let fixture = fs::read_to_string(FIXTURE_PATH).expect("Failed to read canonical fixture");
    let value: Value = serde_json::from_str(&fixture).expect("Invalid JSON");

    let diff_json = &value["diffAst"];

    // Deserialize as a generic Value first to verify structure
    let diff_value: Value = diff_json.clone();

    // Verify field names are snake_case
    assert!(
        diff_value.get("task_id").is_some(),
        "task_id must be snake_case"
    );
    assert!(
        diff_value.get("doc_a_id").is_some(),
        "doc_a_id must be snake_case"
    );
    assert!(
        diff_value.get("doc_b_id").is_some(),
        "doc_b_id must be snake_case"
    );
    assert!(
        diff_value.get("generated_at").is_some(),
        "generated_at must be snake_case"
    );

    // Verify items
    let items = diff_value["items"].as_array().expect("items must be array");
    assert_eq!(items.len(), 3);

    // Verify first item field names
    let item = &items[0];
    assert!(
        item.get("match_id").is_some(),
        "match_id must be snake_case"
    );
    assert!(
        item.get("match_type").is_some(),
        "match_type must be snake_case"
    );
    assert!(
        item.get("source_a").is_some(),
        "source_a must be snake_case"
    );
    assert!(
        item.get("source_b").is_some(),
        "source_b must be snake_case"
    );
    assert!(
        item.get("node_ids_a").is_some(),
        "node_ids_a must be snake_case"
    );
    assert!(
        item.get("node_ids_b").is_some(),
        "node_ids_b must be snake_case"
    );
    assert!(
        item.get("diff_detail").is_some(),
        "diff_detail must be snake_case"
    );
    assert!(
        item.get("block_type").is_some(),
        "block_type must be snake_case"
    );

    // Verify match types
    assert_eq!(items[0]["match_type"], "modified");
    assert_eq!(items[1]["match_type"], "deleted");
    assert_eq!(items[2]["match_type"], "added");

    // Verify summary
    let summary = &diff_value["summary"];
    assert_eq!(summary["modified"], 1);
    assert_eq!(summary["added"], 1);
    assert_eq!(summary["deleted"], 1);
}

#[test]
fn canonical_fixture_field_mapping_consistency() {
    let fixture = fs::read_to_string(FIXTURE_PATH).expect("Failed to read canonical fixture");
    let value: Value = serde_json::from_str(&fixture).expect("Invalid JSON");

    let mapping = &value["fieldMapping"];
    assert!(mapping.is_object(), "fieldMapping must be an object");

    // Verify some key mappings
    assert_eq!(mapping["taskId"], "task_id");
    assert_eq!(mapping["matchType"], "match_type");
    assert_eq!(mapping["sourceA"], "source_a");
    assert_eq!(mapping["nodeIdsA"], "node_ids_a");
    assert_eq!(mapping["diffDetail"], "diff_detail");
    assert_eq!(mapping["blockType"], "block_type");
    assert_eq!(mapping["pageCount"], "page_count");
    assert_eq!(mapping["wordCount"], "word_count");
    assert_eq!(mapping["parserVersion"], "parser_version");
    assert_eq!(mapping["revisionType"], "revision_type");
    assert_eq!(mapping["backgroundColor"], "background_color");
    assert_eq!(mapping["indentFirstLine"], "indent_first_line");
}

#[test]
fn rust_diff_ast_uses_snake_case_fields() {
    use diff_engine::{DiffAst, DiffItem, MatchType};

    let item = DiffItem {
        match_id: "m-001".to_string(),
        match_type: MatchType::Modified,
        confidence: 0.85,
        similarity: 0.85,
        source_a: Some("text A".to_string()),
        source_b: Some("text B".to_string()),
        node_ids_a: vec!["p1".to_string()],
        node_ids_b: vec!["p2".to_string()],
        summary: "changed".to_string(),
    };

    let ast = DiffAst {
        task_id: "t-001".to_string(),
        doc_a_id: "a".to_string(),
        doc_b_id: "b".to_string(),
        items: vec![item],
    };

    let json = serde_json::to_value(&ast).unwrap();

    // Verify all field names are snake_case
    assert!(json.get("task_id").is_some());
    assert!(json.get("doc_a_id").is_some());
    assert!(json.get("doc_b_id").is_some());

    let items = json["items"].as_array().unwrap();
    assert!(items[0].get("match_id").is_some());
    assert!(items[0].get("match_type").is_some());
    assert!(items[0].get("source_a").is_some());
    assert!(items[0].get("source_b").is_some());
    assert!(items[0].get("node_ids_a").is_some());
    assert!(items[0].get("node_ids_b").is_some());
}
