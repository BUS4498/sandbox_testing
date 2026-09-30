-- Synthetic local-only reset fixture. Never run against a hosted database.
INSERT INTO student_setups (owner_id,mode,profile_text,preferences_json,confirmed_at,updated_at)
VALUES ('reset-smoke-owner','SYNTHETIC_DEMONSTRATION','','{}',NULL,'2026-09-28T00:00:00.000Z');
INSERT INTO opportunities (id,owner_id,canonical_url,employer_posting_id,normalized_company,normalized_role,normalized_location,normalized_period,record_json,record_version,created_at,updated_at)
VALUES ('11111111-1111-4111-8111-111111111111','reset-smoke-owner','https://example.org/jobs/reset-smoke','','reset test co','analyst intern','california','summer 2027','{"opportunityId":"11111111-1111-4111-8111-111111111111","company":"Reset Test Co","roleTitle":"Analyst Intern"}',1,'2026-09-28T00:00:00.000Z','2026-09-28T00:00:00.000Z');
INSERT INTO runs (id,owner_id,kind,status,stage,detail,progress,started_at,finished_at,summary_json,error_code)
VALUES ('22222222-2222-4222-8222-222222222222','reset-smoke-owner','COLLECTION','SUCCESS','FINISHED','Synthetic reset fixture',100,'2026-09-28T00:00:00.000Z','2026-09-28T00:00:01.000Z',NULL,NULL);
INSERT INTO operational_events (id,owner_id,run_id,opportunity_id,kind,payload_json,created_at)
VALUES ('33333333-3333-4333-8333-333333333333','reset-smoke-owner','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','SPREADSHEET_ROW_ADDED','{}','2026-09-28T00:00:01.000Z');
INSERT INTO student_responses (id,owner_id,opportunity_id,opportunity_version,response_type,response_text,status,created_at,processed_at,error_code)
VALUES ('44444444-4444-4444-8444-444444444444','reset-smoke-owner','11111111-1111-4111-8111-111111111111',1,'INFORMATION','Synthetic answer','COMPLETE','2026-09-28T00:00:02.000Z','2026-09-28T00:00:03.000Z',NULL);
