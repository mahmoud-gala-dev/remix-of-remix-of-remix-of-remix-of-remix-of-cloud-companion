-- Add excel_uploaded_by column to bugs table to track who uploaded the Excel file
-- that created each bug (separate from reported_by which tracks manual bug reporters).
ALTER TABLE bugs
  ADD COLUMN IF NOT EXISTS excel_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index to make "show me all bugs imported by this user" queries fast.
CREATE INDEX IF NOT EXISTS bugs_excel_uploaded_by_idx ON bugs (excel_uploaded_by);

COMMENT ON COLUMN bugs.excel_uploaded_by IS
  'UUID of the user who imported this bug via an Excel/spreadsheet upload. '
  'NULL when the bug was created manually or via the form. '
  'Distinct from reported_by, which records whoever opened the bug report.';
