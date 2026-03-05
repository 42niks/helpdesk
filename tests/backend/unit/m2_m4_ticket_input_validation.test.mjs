import test from "node:test";
import assert from "node:assert/strict";

import {
  validateCommentInput,
  validateReviewInput,
  validateTicketCreateInput,
} from "../../../src/app/tickets/validation.mjs";

test("validateTicketCreateInput accepts valid ticket input", () => {
  const result = validateTicketCreateInput({
    issue_type: "electrical",
    title: "Bedroom switch not working",
    description: "The bedroom light switch is sparking and needs repair.",
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.issue_type, "electrical");
});

test("validateTicketCreateInput rejects invalid issue type and short fields", () => {
  const result = validateTicketCreateInput({
    issue_type: "hvac",
    title: "short",
    description: "too short",
  });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.issue_type, "Issue type must be electrical or plumbing.");
  assert.equal(result.errors.title, "Title must be between 8 and 120 characters.");
  assert.equal(result.errors.description, "Description must be at least 10 characters.");
});

test("validateCommentInput accepts and trims comment text", () => {
  const result = validateCommentInput({
    comment_text: "  Please call before you visit.  ",
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.comment_text, "Please call before you visit.");
});

test("validateCommentInput rejects empty and overlong comments", () => {
  const emptyResult = validateCommentInput({
    comment_text: "   ",
  });
  assert.equal(emptyResult.isValid, false);
  assert.equal(emptyResult.errors.comment_text, "Comment must be between 1 and 2000 characters.");

  const longResult = validateCommentInput({
    comment_text: "a".repeat(2001),
  });
  assert.equal(longResult.isValid, false);
  assert.equal(longResult.errors.comment_text, "Comment must be between 1 and 2000 characters.");
});

test("validateReviewInput accepts rating-only and rating+text combinations", () => {
  const ratingOnlyResult = validateReviewInput({
    rating: "4",
    review_text: "",
  });
  assert.equal(ratingOnlyResult.isValid, true);
  assert.equal(ratingOnlyResult.values.rating, 4);
  assert.equal(ratingOnlyResult.values.review_text, "");

  const ratedResult = validateReviewInput({
    rating: "5",
    review_text: "Quick and professional work.",
  });
  assert.equal(ratedResult.isValid, true);
  assert.equal(ratedResult.values.rating, 5);
  assert.equal(ratedResult.values.review_text, "Quick and professional work.");
});

test("validateReviewInput rejects missing rating and invalid rating", () => {
  const missingRating = validateReviewInput({
    rating: "",
    review_text: "Needs rating.",
  });
  assert.equal(missingRating.isValid, false);
  assert.equal(missingRating.errors.rating, "Rating is required.");

  const invalidRating = validateReviewInput({
    rating: "9",
    review_text: "",
  });
  assert.equal(invalidRating.isValid, false);
  assert.equal(invalidRating.errors.rating, "Rating must be a whole number between 1 and 5.");
});
