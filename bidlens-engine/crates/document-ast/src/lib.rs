use serde::{Deserialize, Serialize};

// ============================================================================
// Format Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextFormat {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub font_family: Option<String>,
    pub font_size: Option<f32>,
    pub color: Option<String>,
    pub background_color: Option<String>,
    pub strikethrough: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParagraphFormat {
    pub alignment: Option<Alignment>,
    pub indent_left: Option<f32>,
    pub indent_right: Option<f32>,
    pub indent_first_line: Option<f32>,
    pub line_spacing: Option<f32>,
    pub space_before: Option<f32>,
    pub space_after: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Alignment {
    Left,
    Center,
    Right,
    Justify,
}

// ============================================================================
// Run Node (Text Run)
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RunNode {
    pub id: String,
    pub text: String,
    pub format: Option<TextFormat>,
}

impl RunNode {
    /// Returns the plain text content of this run.
    pub fn plain_text(&self) -> &str {
        &self.text
    }
}

// ============================================================================
// Document AST
// ============================================================================

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
    pub runs: Vec<RunNode>,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
    pub paragraph_format: Option<ParagraphFormat>,
}

impl ParagraphNode {
    /// Returns the plain text content by concatenating all run texts.
    /// This provides backward compatibility for code that needs plain text.
    pub fn plain_text(&self) -> String {
        self.runs
            .iter()
            .map(|run| run.text.as_str())
            .collect::<Vec<_>>()
            .join("")
    }
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

// ============================================================================
// Helper Functions
// ============================================================================

/// Extract paragraphs as (id, plain_text) pairs from a document.
/// Returns owned Strings since plain_text() is computed on the fly.
pub fn paragraphs(doc: &DocumentAst) -> Vec<(String, String)> {
    doc.blocks
        .iter()
        .filter_map(|block| match block {
            BlockNode::Paragraph(p) => Some((p.id.clone(), p.plain_text())),
            BlockNode::Table(_) => None,
        })
        .collect()
}

/// Create a ParagraphNode with a single run (convenience for simple text).
pub fn simple_paragraph(id: &str, text: &str) -> ParagraphNode {
    ParagraphNode {
        id: id.to_string(),
        runs: vec![RunNode {
            id: format!("{}-run-0", id),
            text: text.to_string(),
            format: None,
        }],
        page_start: None,
        page_end: None,
        paragraph_format: None,
    }
}

/// Create a ParagraphNode with a single run and page info.
pub fn paragraph_with_pages(id: &str, text: &str, page_start: usize, page_end: usize) -> ParagraphNode {
    ParagraphNode {
        id: id.to_string(),
        runs: vec![RunNode {
            id: format!("{}-run-0", id),
            text: text.to_string(),
            format: None,
        }],
        page_start: Some(page_start),
        page_end: Some(page_end),
        paragraph_format: None,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_format_serialization_roundtrip() {
        let format = TextFormat {
            bold: Some(true),
            italic: Some(false),
            underline: Some(true),
            font_family: Some("Arial".to_string()),
            font_size: Some(12.0),
            color: Some("#FF0000".to_string()),
            background_color: Some("#FFFFFF".to_string()),
            strikethrough: None,
        };

        let json = serde_json::to_string(&format).unwrap();
        let deserialized: TextFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(format, deserialized);
    }

    #[test]
    fn test_paragraph_format_serialization_roundtrip() {
        let format = ParagraphFormat {
            alignment: Some(Alignment::Justify),
            indent_left: Some(36.0),
            indent_right: Some(36.0),
            indent_first_line: Some(72.0),
            line_spacing: Some(1.5),
            space_before: Some(6.0),
            space_after: Some(6.0),
        };

        let json = serde_json::to_string(&format).unwrap();
        let deserialized: ParagraphFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(format, deserialized);
    }

    #[test]
    fn test_alignment_serialization() {
        let cases = vec![
            (Alignment::Left, r#""left""#),
            (Alignment::Center, r#""center""#),
            (Alignment::Right, r#""right""#),
            (Alignment::Justify, r#""justify""#),
        ];

        for (alignment, expected) in cases {
            let json = serde_json::to_string(&alignment).unwrap();
            assert_eq!(json, expected);

            // Roundtrip
            let deserialized: Alignment = serde_json::from_str(&json).unwrap();
            assert_eq!(alignment, deserialized);
        }
    }

    #[test]
    fn test_run_node_serialization_roundtrip() {
        let run = RunNode {
            id: "run-1".to_string(),
            text: "Hello World".to_string(),
            format: Some(TextFormat {
                bold: Some(true),
                italic: None,
                underline: None,
                font_family: None,
                font_size: None,
                color: None,
                background_color: None,
                strikethrough: None,
            }),
        };

        let json = serde_json::to_string(&run).unwrap();
        let deserialized: RunNode = serde_json::from_str(&json).unwrap();
        assert_eq!(run, deserialized);
        assert_eq!(deserialized.plain_text(), "Hello World");
    }

    #[test]
    fn test_run_node_without_format() {
        let run = RunNode {
            id: "run-2".to_string(),
            text: "Plain text".to_string(),
            format: None,
        };

        let json = serde_json::to_string(&run).unwrap();
        let deserialized: RunNode = serde_json::from_str(&json).unwrap();
        assert_eq!(run, deserialized);
    }

    #[test]
    fn test_paragraph_node_with_runs() {
        let para = ParagraphNode {
            id: "p-1".to_string(),
            runs: vec![
                RunNode {
                    id: "run-1".to_string(),
                    text: "Hello ".to_string(),
                    format: Some(TextFormat {
                        bold: Some(true),
                        italic: None,
                        underline: None,
                        font_family: None,
                        font_size: None,
                        color: None,
                        background_color: None,
                        strikethrough: None,
                    }),
                },
                RunNode {
                    id: "run-2".to_string(),
                    text: "World".to_string(),
                    format: None,
                },
            ],
            page_start: Some(1),
            page_end: Some(1),
            paragraph_format: Some(ParagraphFormat {
                alignment: Some(Alignment::Left),
                indent_left: None,
                indent_right: None,
                indent_first_line: None,
                line_spacing: None,
                space_before: None,
                space_after: None,
            }),
        };

        // Test plain_text concatenation
        assert_eq!(para.plain_text(), "Hello World");

        // Test serialization roundtrip
        let json = serde_json::to_string_pretty(&para).unwrap();
        let deserialized: ParagraphNode = serde_json::from_str(&json).unwrap();
        assert_eq!(para, deserialized);
        assert_eq!(deserialized.plain_text(), "Hello World");
    }

    #[test]
    fn test_paragraph_node_backward_compatibility() {
        // Test that we can create paragraphs easily with the helper functions
        let para = simple_paragraph("p-1", "Simple text");
        assert_eq!(para.plain_text(), "Simple text");
        assert_eq!(para.runs.len(), 1);
        assert_eq!(para.runs[0].text, "Simple text");

        let para_pages = paragraph_with_pages("p-2", "Page text", 1, 1);
        assert_eq!(para_pages.plain_text(), "Page text");
        assert_eq!(para_pages.page_start, Some(1));
        assert_eq!(para_pages.page_end, Some(1));
    }

    #[test]
    fn test_paragraphs_helper_function() {
        let doc = DocumentAst {
            id: "test-doc".to_string(),
            filename: "test.pdf".to_string(),
            sha256: "abc123".to_string(),
            page_count: Some(1),
            word_count: 10,
            parser_version: "0.1.0".to_string(),
            blocks: vec![
                BlockNode::Paragraph(simple_paragraph("p-1", "First paragraph")),
                BlockNode::Table(TableNode {
                    id: "t-1".to_string(),
                    rows: vec![],
                    page_start: Some(1),
                    page_end: Some(1),
                    properties: None,
                }),
                BlockNode::Paragraph(simple_paragraph("p-2", "Second paragraph")),
            ],
        };

        let paras = paragraphs(&doc);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[0].0, "p-1");
        assert_eq!(paras[0].1, "First paragraph");
        assert_eq!(paras[1].0, "p-2");
        assert_eq!(paras[1].1, "Second paragraph");
    }

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
                            content: vec![BlockNode::Paragraph(simple_paragraph("p-1", "Header 1"))],
                            span: None,
                            properties: None,
                        },
                        TableCell {
                            id: "cell-2".to_string(),
                            content: vec![BlockNode::Paragraph(simple_paragraph("p-2", "Header 2"))],
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
                            content: vec![BlockNode::Paragraph(simple_paragraph("p-3", "Value 1"))],
                            span: None,
                            properties: None,
                        },
                        TableCell {
                            id: "cell-4".to_string(),
                            content: vec![BlockNode::Paragraph(simple_paragraph("p-4", "Value 2"))],
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

        let json = serde_json::to_string_pretty(&table).expect("Failed to serialize TableNode");
        let deserialized: TableNode = serde_json::from_str(&json).expect("Failed to deserialize TableNode");
        assert_eq!(table, deserialized);
    }

    #[test]
    fn test_row_type_variants() {
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
                BlockNode::Paragraph(paragraph_with_pages("p-1", "Introduction", 1, 1)),
                BlockNode::Table(TableNode {
                    id: "t-1".to_string(),
                    rows: vec![TableRow {
                        id: "r-1".to_string(),
                        cells: vec![
                            TableCell {
                                id: "c-1".to_string(),
                                content: vec![BlockNode::Paragraph(simple_paragraph("cp-1", "Cell A"))],
                                span: None,
                                properties: None,
                            },
                            TableCell {
                                id: "c-2".to_string(),
                                content: vec![BlockNode::Paragraph(simple_paragraph("cp-2", "Cell B"))],
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
                BlockNode::Paragraph(paragraph_with_pages("p-2", "Conclusion", 3, 3)),
            ],
        };

        // Serialize the entire document
        let json = serde_json::to_string_pretty(&doc).expect("Failed to serialize DocumentAst");
        let deserialized: DocumentAst = serde_json::from_str(&json).expect("Failed to deserialize DocumentAst");
        assert_eq!(doc, deserialized);

        // Verify paragraphs function still works
        let paras = paragraphs(&deserialized);
        assert_eq!(paras.len(), 2);
        assert_eq!(paras[0].1, "Introduction");
        assert_eq!(paras[1].1, "Conclusion");
    }

    #[test]
    fn test_multiple_runs_plain_text() {
        // Test that multiple runs concatenate correctly
        let para = ParagraphNode {
            id: "p-multi".to_string(),
            runs: vec![
                RunNode {
                    id: "r-1".to_string(),
                    text: "Bold ".to_string(),
                    format: Some(TextFormat {
                        bold: Some(true),
                        italic: None,
                        underline: None,
                        font_family: None,
                        font_size: None,
                        color: None,
                        background_color: None,
                        strikethrough: None,
                    }),
                },
                RunNode {
                    id: "r-2".to_string(),
                    text: "and ".to_string(),
                    format: None,
                },
                RunNode {
                    id: "r-3".to_string(),
                    text: "Italic".to_string(),
                    format: Some(TextFormat {
                        bold: None,
                        italic: Some(true),
                        underline: None,
                        font_family: None,
                        font_size: None,
                        color: None,
                        background_color: None,
                        strikethrough: None,
                    }),
                },
            ],
            page_start: None,
            page_end: None,
            paragraph_format: None,
        };

        assert_eq!(para.plain_text(), "Bold and Italic");
    }

    #[test]
    fn test_empty_runs() {
        let para = ParagraphNode {
            id: "p-empty".to_string(),
            runs: vec![],
            page_start: None,
            page_end: None,
            paragraph_format: None,
        };

        assert_eq!(para.plain_text(), "");
    }

    #[test]
    fn test_format_with_all_none() {
        let format = TextFormat {
            bold: None,
            italic: None,
            underline: None,
            font_family: None,
            font_size: None,
            color: None,
            background_color: None,
            strikethrough: None,
        };

        let json = serde_json::to_string(&format).unwrap();
        let deserialized: TextFormat = serde_json::from_str(&json).unwrap();
        assert_eq!(format, deserialized);
    }
}

