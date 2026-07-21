//! Score computation and risk presets.

use serde::{Deserialize, Serialize};

use crate::{RiskLevel, RiskPreset, ScoreBreakdown};

const RULE_VERSION: &str = "0.3.0";

/// Thresholds for classifying risk levels.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskThresholds {
    pub high: f64,
    pub medium: f64,
    pub low: f64,
}

/// Preset configuration with risk thresholds.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresetConfig {
    pub preset: RiskPreset,
    pub risk_thresholds: RiskThresholds,
}

impl PresetConfig {
    pub fn for_preset(preset: RiskPreset) -> Self {
        match preset {
            RiskPreset::Strict => Self {
                preset,
                risk_thresholds: RiskThresholds {
                    high: 0.6,
                    medium: 0.4,
                    low: 0.2,
                },
            },
            RiskPreset::Standard => Self {
                preset,
                risk_thresholds: RiskThresholds {
                    high: 0.75,
                    medium: 0.5,
                    low: 0.3,
                },
            },
            RiskPreset::Loose => Self {
                preset,
                risk_thresholds: RiskThresholds {
                    high: 0.85,
                    medium: 0.65,
                    low: 0.45,
                },
            },
        }
    }

    /// Classify a final score into a risk level using this preset's thresholds.
    pub fn classify(&self, final_score: f64) -> RiskLevel {
        if final_score >= self.risk_thresholds.high {
            RiskLevel::High
        } else if final_score >= self.risk_thresholds.medium {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }
}

/// Compute a `ScoreBreakdown` from individual component scores.
///
/// Final score formula:
///   raw = max(exact, lexical, structural) * 0.5
///       + entity_score * 0.25
///       + fact_score * 0.25
///   adjusted = raw * (1 - tender_discount) * (1 - template_discount) - fact_conflict_penalty
///   final = clamp(adjusted, 0.0, 1.0)
pub fn compute_score(
    exact_match_score: f64,
    lexical_score: f64,
    structural_score: f64,
    entity_score: f64,
    fact_score: f64,
    tender_discount: f64,
    template_discount: f64,
    fact_conflict_penalty: f64,
) -> ScoreBreakdown {
    let text_component = exact_match_score.max(lexical_score).max(structural_score);
    let raw = text_component * 0.5 + entity_score * 0.25 + fact_score * 0.25;
    let adjusted = raw * (1.0 - tender_discount) * (1.0 - template_discount) - fact_conflict_penalty;
    let final_score = adjusted.clamp(0.0, 1.0);

    ScoreBreakdown {
        exact_match_score,
        lexical_score,
        structural_score,
        entity_score,
        fact_score,
        tender_discount,
        template_discount,
        fact_conflict_penalty,
        final_score,
        rule_version: RULE_VERSION.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_basic_combination() {
        let s = compute_score(0.0, 0.8, 0.7, 0.6, 0.5, 0.0, 0.0, 0.0);
        // text = max(0, 0.8, 0.7) = 0.8
        // raw = 0.8 * 0.5 + 0.6 * 0.25 + 0.5 * 0.25 = 0.4 + 0.15 + 0.125 = 0.675
        assert!((s.final_score - 0.675).abs() < 0.001);
    }

    #[test]
    fn score_exact_match_dominates() {
        let s = compute_score(1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        // raw = 1.0 * 0.5 + 0 + 0 = 0.5
        assert!((s.final_score - 0.5).abs() < 0.001);
    }

    #[test]
    fn score_tender_discount() {
        let no_discount = compute_score(0.0, 0.8, 0.0, 0.6, 0.4, 0.0, 0.0, 0.0);
        let with_discount = compute_score(0.0, 0.8, 0.0, 0.6, 0.4, 0.5, 0.0, 0.0);
        assert!(with_discount.final_score < no_discount.final_score);
        // raw = max(0,0.8,0)*0.5 + 0.6*0.25 + 0.4*0.25 = 0.65
        // adjusted = 0.65 * 0.5 = 0.325
        assert!((with_discount.final_score - 0.325).abs() < 0.001);
    }

    #[test]
    fn score_template_discount() {
        let s = compute_score(0.0, 0.8, 0.0, 0.6, 0.4, 0.0, 0.3, 0.0);
        // raw = 0.65, adjusted = 0.65 * 0.7 = 0.455
        assert!((s.final_score - 0.455).abs() < 0.001);
    }

    #[test]
    fn score_fact_conflict_penalty() {
        let s = compute_score(0.0, 0.8, 0.0, 0.6, 0.4, 0.0, 0.0, 0.1);
        // raw = 0.65, adjusted = 0.65 - 0.1 = 0.55
        assert!((s.final_score - 0.55).abs() < 0.001);
    }

    #[test]
    fn score_clamped_to_zero() {
        let s = compute_score(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0);
        assert_eq!(s.final_score, 0.0);
    }

    #[test]
    fn score_clamped_to_one() {
        let s = compute_score(1.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0);
        assert_eq!(s.final_score, 1.0);
    }

    #[test]
    fn preset_strict_thresholds() {
        let cfg = PresetConfig::for_preset(RiskPreset::Strict);
        assert_eq!(cfg.classify(0.7), RiskLevel::High);
        assert_eq!(cfg.classify(0.5), RiskLevel::Medium);
        assert_eq!(cfg.classify(0.1), RiskLevel::Low);
    }

    #[test]
    fn preset_standard_thresholds() {
        let cfg = PresetConfig::for_preset(RiskPreset::Standard);
        assert_eq!(cfg.classify(0.8), RiskLevel::High);
        assert_eq!(cfg.classify(0.6), RiskLevel::Medium);
        assert_eq!(cfg.classify(0.2), RiskLevel::Low);
    }

    #[test]
    fn preset_loose_thresholds() {
        let cfg = PresetConfig::for_preset(RiskPreset::Loose);
        assert_eq!(cfg.classify(0.9), RiskLevel::High);
        assert_eq!(cfg.classify(0.7), RiskLevel::Medium);
        assert_eq!(cfg.classify(0.3), RiskLevel::Low);
    }

    #[test]
    fn score_rule_version_set() {
        let s = compute_score(0.5, 0.5, 0.5, 0.5, 0.5, 0.0, 0.0, 0.0);
        assert_eq!(s.rule_version, "0.3.0");
    }
}
