# Communication Drafter — Tool Contract

## Status

Specification only; no drafting model or sending integration is implemented.

## Responsibility

Create editable drafts for student review using posting facts and verified student evidence.

## Inputs

- Intended audience and purpose.
- Relevant posting evidence.
- Verified profile snapshot and student-selected facts.
- Tone, length, and constraints supplied by the student.

## Outputs

- Draft ID and exact draft text.
- Sources used, unresolved placeholders, and excluded unsupported claims.
- `draft_only` status and required approval metadata.

## Constraints

- Never fabricate qualifications, enthusiasm, relationships, or prior interactions.
- Clearly mark unresolved facts and placeholders.
- Do not silently change final application materials.
- Never send, post, upload, or submit a draft.
- Any future send operation must be separate and require approval of the exact recipient and exact content.

## Verification

Verify that the draft was saved locally and that no send action occurred. Draft quality evaluation remains distinct from approval.

