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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ParagraphNode {
    pub id: String,
    pub text: String,
    pub page_start: Option<usize>,
    pub page_end: Option<usize>,
}

pub fn paragraphs(doc: &DocumentAst) -> Vec<(&str, &str)> {
    doc.blocks
        .iter()
        .map(|block| match block {
            BlockNode::Paragraph(p) => (p.id.as_str(), p.text.as_str()),
        })
        .collect()
}
