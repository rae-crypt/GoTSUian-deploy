const db = require('./config/db');

// Evidence on a report (IT expert review, 2026-10-04): whoever files a
// complaint can attach one optional photo (a screenshot, the tricycle, a
// receipt) so the admin has a basis before warning or suspending anyone,
// instead of "he said, she said". complaints.evidence_path, NULL when none.
// Only the admin can view it (see getComplaintEvidence).

// Whether the column is known to exist. Until it is, reports still work;
// only attaching a photo waits.
let evidenceColumnReady = false;

function hasEvidenceColumn() {
  return evidenceColumnReady;
}

// Run once at startup. Additions only, skipped when the column is there.
function ensureEvidenceColumn() {
  db.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'complaints' AND COLUMN_NAME = 'evidence_path'`,
    (err, rows) => {
      if (err) return console.warn('Could not check complaints.evidence_path:', err.message);
      if (rows.length) {
        evidenceColumnReady = true;
        return;
      }
      db.query(`ALTER TABLE complaints ADD COLUMN evidence_path VARCHAR(255) NULL DEFAULT NULL`, (alterErr) => {
        if (alterErr) return console.warn('Could not add complaints.evidence_path:', alterErr.message);
        evidenceColumnReady = true;
      });
    }
  );
}

module.exports = { ensureEvidenceColumn, hasEvidenceColumn };
