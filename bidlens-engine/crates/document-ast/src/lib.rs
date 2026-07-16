use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DocumentAst {
    pub id: String,
    pub filename: String,
    pub sha256: String,
    pub page_count: Option<usize>,
    pub word_count: usize,
    pub parser_version: String,
    pub blocks: Vec<BlockNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum BlockNode {
    Paragraph(ParagraphNode),
    Table(TableNode),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParagraphNode {
    pub id: String,
    pub text: String,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableNode {
    pub id: String,
    pub rows: Vec<TableRow>,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
    pub properties: Option<TableProperties>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableRow {
    pub id: String,
    pub cells: Vec<TableCell>,
    pub row_type: RowType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableCell {
    pub id: String,
    pub content: Vec<BlockNode>,
    pub span: Option<CellSpan>,
    pub properties: Option<CellProperties>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CellSpan {
    pub row_span: usize,
    pub col_span: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RowType {
    Header,
    Body,
    Footer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TableProperties {
    // Optional table properties
    // Can be extended later
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CellProperties {
    // Optional cell properties
    // Can be extended later
}

pub fn paragraphs(doc: &DocumentAst) -> Vec<(&str, &str)> {
    doc.blocks
        .iter()
        .filter_map(|block| match block {
            BlockNode::Paragraph(p) => Some((p.id.as_str(), p.text.as_str())),
            BlockNode::Table(_) => None,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_table_serialization_roundtrip() {
        let table = TableNode {
            id: "table-1".to_string(),
            rows: vec![
                TableRow {
                    id: "row-1".to_string(),
                    cells: vec![
                        TableCell {
                            id: "cell-1".to_string(),
                            content: vec![BlockNode::Paragraph(ParagraphNode {
                                id: "p-1".to_string(),
                                text: "Header 1".to_string(),
                                page_start: Some(1),
                                page_end: Some(1),
                            })],
                            span: None,
                            properties: None,
                        },
                        TableCell {
                            id: "cell-2".to_string(),
                            content: vec![BlockNode::Paragraph(ParagraphNode {
                                id: "p-2".to_string(),
                                text: "Header 2".to_string(),
                                page_start: Some(1),
                                page_end: Some(1),
                            })],
                            span: None,
                            properties: None,
                        },
                    ],
                    row_type: RowType::Header,
                },
                TableRow {
                    id: "row-2".to_string(),
                    cells: vec![
                        TableCell {
                            id: "cell-3".to_string(),
                            content: vec![BlockNode::Paragraph(ParagraphNode {
                                id: "p-3".to_string(),
                                text: "Value 1".to_string(),
                                page_start: Some(1),
                                page_end: Some(1),
                            })],
                            span: None,
                            properties: None,
                        },
                        TableCell {
                            id: "cell-4".to_string(),
                            content: vec![BlockNode::Paragraph(ParagraphNode {
                                id: "p-4".to_string(),
                                text: "Value 2".to_string(),
                                page_start: Some(1),
                                page_end: Some(1),
                            })],
                            span: None,
                            properties: None,
                        },
                    ],
                    row_type: RowType::Body,
                },
            ],
            page_start: Some(1),
            page_end: Some(1),
            properties: None,
        };

        let block = BlockNode::Table(table.clone());
        let json = serde_json::to_string(&block).expect("Failed to serialize Table");
        let deserialized: BlockNode = serde_json::from_str(&json).expect("Failed to deserialize Table");
        assert_eq!(block, deserialized);
    }

    #[test]
    fn test_table_with_cell_span() {
        let table = TableNode {
            id: "table-span".to_string(),
            rows: vec![TableRow {
                id: "row-1".to_string(),
                cells: vec![TableCell {
                    id: "cell-1".to_string(),
                    content: vec![BlockNode::Paragraph(ParagraphNode {
                        id: "p-1".to_string(),
                        text: "Merged cell".to_string(),
                        page_start: None,
                        page_end: None,
                    })],
                    span: Some(CellSpan {
                        row_span: 2,
                        col_span: 3,
                    }),
                    properties: None,
                }],
                row_type: RowType::Body,
            }],
            page_start: None,
            page_end: None,
            properties: None,
        };

        let block = BlockNode::Table(table.clone());
        let json = serde_json::to_string_pretty(&block).expect("Failed to serialize Table with span");
        let deserialized: BlockNode = serde_json::from_str(&json).expect("Failed to deserialize Table with span");
        assert_eq!(block, deserialized);
    }

    #[test]
    fn test_table_with_properties() {
        let table = TableNode {
            id: "table-props".to_string(),
            rows: vec![],
            page_start: Some(2),
            page_end: Some(3),
            properties: Some(TableProperties {}),
        };

        let block = BlockNode::Table(table.clone());
        let json = serde_json::to_string(&block).expect("Failed to serialize Table with properties");
        let deserialized: BlockNode = serde_json::from_str(&json).expect("Failed to deserialize Table with properties");
        assert_eq!(block, deserialized);
    }

    #[test]
    fn test_table_cell_with_nested_table() {
        // Test nested table inside a cell
        let inner_table = TableNode {
            id: "inner-table".to_string(),
            rows: vec![TableRow {
                id: "inner-row-1".to_string(),
                cells: vec![TableCell {
                    id: "inner-cell-1".to_string(),
                    content: vec![BlockNode::Paragraph(ParagraphNode {
                        id: "inner-p-1".to_string(),
                        text: "Nested cell".to_string(),
                        page_start: None,
                        page_end: None,
                    })],
                    span: None,
                    properties: None,
                }],
                row_type: RowType::Body,
            }],
            page_start: None,
            page_end: None,
            properties: None,
        };

        let outer_table = TableNode {
            id: "outer-table".to_string(),
            rows: vec![TableRow {
                id: "outer-row-1".to_string(),
                cells: vec![TableCell {
                    id: "outer-cell-1".to_string(),
                    content: vec![BlockNode::Table(inner_table)],
                    span: None,
                    properties: None,
                }],
                row_type: RowType::Body,
            }],
            page_start: Some(1),
            page_end: Some(1),
            properties: None,
        };

        let block = BlockNode::Table(outer_table);
        let json = serde_json::to_string(&block).expect("Failed to serialize nested Table");
        let deserialized: BlockNode = serde_json::from_str(&json).expect("Failed to deserialize nested Table");
        assert_eq!(block, deserialized);
    }

    #[test]
    fn test_block_node_json_tagged_type() {
        // Verify JSON output uses the "type" tag and correct rename
        let para = BlockNode::Paragraph(ParagraphNode {
            id: "p-1".to_string(),
            text: "Hello".to_string(),
            page_start: Some(1),
            page_end: Some(1),
        });
        let json = serde_json::to_string(&para).unwrap();
        assert!(json.contains(r#""type":"paragraph""#), "Paragraph type tag missing");

        let table = BlockNode::Table(TableNode {
            id: "t-1".to_string(),
            rows: vec![],
            page_start: None,
            page_end: None,
            properties: None,
        });
        let json = serde_json::to_string(&table).unwrap();
        assert!(json.contains(r#""type":"table""#), "Table type tag missing");
    }

    #[test]
    fn test_paragraphs_excludes_tables() {
        let doc = DocumentAst {
            id: "doc-1".to_string(),
            filename: "test.pdf".to_string(),
            sha256: "abc123".to_string(),
            page_count: Some(1),
            word_count: 10,
            parser_version: "0.1.0".to_string(),
            blocks: vec![
                BlockNode::Paragraph(ParagraphNode {
                    id: "p-1".to_string(),
                    text: "First paragraph".to_string(),
                    page_start: Some(1),
                    page_end: Some(1),
                }),
                BlockNode::Table(TableNode {
                    id: "t-1".to_string(),
                    rows: vec![],
                    page_start: Some(1),
                    page_end: Some(1),
                    properties: None,
                }),
                BlockNode::Paragraph(ParagraphNode {
                    id: "p-2".to_string(),
                    text: "Second paragraph".to_string(),
                    page_start: Some(1),
                    page_end: Some(1),
                }),
            ],
        };

        let paras = paragraphs(&doc);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[0], ("p-1", "First paragraph"));
        assert_eq!(paras[1], ("p-2", "Second paragraph"));
    }

    #[test]
    fn test_row_type_variants() {
        // Test all RowType variants serialize correctly
        let header = RowType::Header;
        let body = RowType::Body;
        let footer = RowType::Footer;

        assert_eq!(serde_json::to_string(&header).unwrap(), r#""header""#);
        assert_eq!(serde_json::to_string(&body).unwrap(), r#""body""#);
        assert_eq!(serde_json::to_string(&footer).unwrap(), r#""footer""#);

        // Roundtrip
        let header_json = serde_json::to_string(&header).unwrap();
        let _: RowType = serde_json::from_str(&header_json).unwrap();
    }

    #[test]
    fn test_document_ast_with_mixed_blocks() {
        let doc = DocumentAst {
            id: "doc-mixed".to_string(),
            filename: "mixed.pdf".to_string(),
            sha256: "def456".to_string(),
            page_count: Some(3),
            word_count: 50,
            parser_version: "0.2.0".to_string(),
            blocks: vec![
                BlockNode::Paragraph(ParagraphNode {
                    id: "p-1".to_string(),
                    text: "Introduction".to_string(),
                    page_start: Some(1),
                    page_end: Some(1),
                }),
                BlockNode::Table(TableNode {
                    id: "t-1".to_string(),
                    rows: vec![TableRow {
                        id: "r-1".to_string(),
                        cells: vec![
                            TableCell {
                                id: "c-1".to_string(),
                                content: vec![BlockNode::Paragraph(ParagraphNode {
                                    id: "cp-1".to_string(),
                                    text: "Cell A".to_string(),
                                    page_start: None,
                                    page_end: None,
                                })],
                                span: None,
                                properties: None,
                            },
                            TableCell {
                                id: "c-2".to_string(),
                                content: vec![BlockNode::Paragraph(ParagraphNode {
                                    id: "cp-2".to_string(),
                                    text: "Cell B".to_string(),
                                    page_start: None,
                                    page_end: None,
                                })],
                                span: Some(CellSpan {
                                    row_span: 1,
                                    col_span: 2,
                                }),
                                properties: Some(CellProperties {}),
                            },
                        ],
                        row_type: RowType::Body,
                    }],
                    page_start: Some(2),
                    page_end: Some(2),
                    properties: Some(TableProperties {}),
                }),
                BlockNode::Paragraph(ParagraphNode {
                    id: "p-2".to_string(),
                    text: "Conclusion".to_string(),
                    page_start: Some(3),
                    page_end: Some(3),
                }),
            ],
        };

        // Serialize the entire document
        let json = serde_json::to_string_pretty(&doc).expect("Failed to serialize DocumentAst");
        let deserialized: DocumentAst = serde_json::from_str(&json).expect("Failed to deserialize DocumentAst");
        assert_eq!(doc, deserialized);

        // Verify paragraphs function still works
        let paras = paragraphs(&deserialized);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[0], ("p-1", "Introduction"));
        assert_eq!(paras[1], ("p-2", "Conclusion"));
    }
}
