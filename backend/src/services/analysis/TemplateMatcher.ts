import { FingerprintV1 } from '../../types/fingerprint.types';
import { Template } from '../../models/Template'; // Using the model export which is PrismaTemplate

export interface MatchResult {
  templateId: string;
  confidence: number;
  reasons: string[];
}

export class TemplateMatcher {
  private readonly WEIGHTS = {
    keyword: 0.4,
    column: 0.3,
    header: 0.2,
    blocks: 0.1
  };

  private readonly THRESHOLD = 0.8;

  findBestMatch(fileFingerprint: FingerprintV1, candidates: Template[]): MatchResult | null {
    let bestMatch: MatchResult | null = null;
    let highestScore = 0;

    for (const template of candidates) {
      if (!template.fingerprint) continue;
      
      const templateFingerprint = template.fingerprint as unknown as FingerprintV1;
      const score = this.calculateScore(fileFingerprint, templateFingerprint);

      if (score.total > highestScore) {
        highestScore = score.total;
        bestMatch = {
          templateId: template.id,
          confidence: score.total,
          reasons: score.reasons
        };
      }
    }

    if (bestMatch && bestMatch.confidence >= this.THRESHOLD) {
      return bestMatch;
    }

    return null;
  }

  private calculateScore(a: FingerprintV1, b: FingerprintV1): { total: number; reasons: string[] } {
    const reasons: string[] = [];

    // 1. Keyword Overlap (Jaccard)
    const keywordsA = new Set(a.top_keywords);
    const keywordsB = new Set(b.top_keywords);
    const intersection = new Set([...keywordsA].filter(x => keywordsB.has(x)));
    const union = new Set([...keywordsA, ...keywordsB]);
    const keywordScore = union.size === 0 ? 0 : intersection.size / union.size;
    if (keywordScore > 0.5) reasons.push(`Keywords match (${(keywordScore*100).toFixed(0)}%)`);

    // 2. Column Signature (Mean Absolute Error of normalized X positions)
    let columnScore = 0;
    if (a.column_x_signature.length > 0 && b.column_x_signature.length > 0) {
        const colsA = a.column_x_signature[0].xs_norm;
        const colsB = b.column_x_signature[0].xs_norm;
        
        // Simple comparison: check if close number of columns
        if (Math.abs(colsA.length - colsB.length) <= 1) {
            // Compare closest columns
            let matchCount = 0;
            for(const xa of colsA) {
                if (colsB.some(xb => Math.abs(xa - xb) < 0.05)) { // 5% tolerance
                    matchCount++;
                }
            }
            columnScore = matchCount / Math.max(colsA.length, colsB.length);
        }
    }
    if (columnScore > 0.8) reasons.push(`Column layout matches`);

    // 3. Header/Footer Hash (Exact Match)
    let headerScore = 0;
    if (a.header_footer_signature.header_text_hash === b.header_footer_signature.header_text_hash) {
        headerScore = 1.0;
        reasons.push('Header text matches exactly');
    }

    // 4. Blocks (Simplified density check)
    // For MVP, if density is similar in top quadrant
    const blocksScore = 0.5; // Placeholder for complex region matching

    const total = 
        (keywordScore * this.WEIGHTS.keyword) +
        (columnScore * this.WEIGHTS.column) +
        (headerScore * this.WEIGHTS.header) +
        (blocksScore * this.WEIGHTS.blocks);

    return { total, reasons };
  }
}
