import os
content = """use serde::{Deserialize, Serialize};

// ============================================================================
// Format Types
// =============================================================================

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
