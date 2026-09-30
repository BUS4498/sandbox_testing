import test from "node:test";
import assert from "node:assert/strict";
import { isEvidenceBackedApplicationUrl, isMultiOpportunityIndexUrl, isSecondaryListing } from "../lib/hosted/source-links.js";

test("recognizes approved secondary discovery sites without matching lookalike hosts", () => {
  assert.equal(isSecondaryListing("https://www.linkedin.com/jobs/view/123"), true);
  assert.equal(isSecondaryListing("https://simplify.jobs/l/example"), true);
  assert.equal(isSecondaryListing("https://linkedin.com.evil.example/jobs/view/123"), false);
  assert.equal(isSecondaryListing("https://jobs.lever.co/example/123"), false);
});

test("shared discovery lists are not treated as individual postings", () => {
  assert.equal(isMultiOpportunityIndexUrl("https://github.com/SimplifyJobs/Summer2027-Internships/raw/refs/heads/dev/README.md"), true);
  assert.equal(isMultiOpportunityIndexUrl("https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/refs/heads/dev/README.md"), true);
  assert.equal(isMultiOpportunityIndexUrl("https://simplify.jobs/l/Top-Summer-Internships-2027"), true);
  assert.equal(isMultiOpportunityIndexUrl("https://intern.usajobs.gov/"), true);
  assert.equal(isMultiOpportunityIndexUrl("https://www.linkedin.com/jobs/search/?keywords=intern"), true);
  assert.equal(isMultiOpportunityIndexUrl("https://directv.wd1.myworkdayjobs.com/careers/job/El-Segundo-CA/Customer-Operations-Intern_R260273"), false);
  assert.equal(isMultiOpportunityIndexUrl("https://github.com/SimplifyJobs/Summer2027-Internships.evil.example/README.md"), false);
});

test("accepts a cited employer application URL", () => {
  const posting = "https://jobs.lever.co/example/123";
  const application = "https://jobs.lever.co/example/123/apply";
  assert.equal(isEvidenceBackedApplicationUrl(application, posting, [posting, application]), true);
});

test("accepts an employer posting that is itself the application entry point", () => {
  const posting = "https://job-boards.greenhouse.io/example/jobs/123";
  assert.equal(isEvidenceBackedApplicationUrl(posting, posting, [posting]), true);
});

test("does not promote uncited or secondary listing links as direct applications", () => {
  const posting = "https://www.linkedin.com/jobs/view/123";
  assert.equal(isEvidenceBackedApplicationUrl("https://jobs.lever.co/example/123", posting, [posting]), false);
  assert.equal(isEvidenceBackedApplicationUrl(posting, posting, [posting]), false);
  assert.equal(isEvidenceBackedApplicationUrl("", posting, [posting]), false);
});
