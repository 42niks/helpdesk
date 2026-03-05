const ISSUE_TYPES = new Set(["electrical", "plumbing"]);

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateTicketCreateInput(input) {
  const issueType = normalize(input.issue_type).toLowerCase();
  const title = normalize(input.title);
  const description = normalize(input.description);
  const errors = {};

  if (!ISSUE_TYPES.has(issueType)) {
    errors.issue_type = "Issue type must be electrical or plumbing.";
  }
  if (title.length < 8 || title.length > 120) {
    errors.title = "Title must be between 8 and 120 characters.";
  }
  if (description.length < 10) {
    errors.description = "Description must be at least 10 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    values: {
      issue_type: issueType,
      title,
      description,
    },
    errors,
  };
}

export function validateCommentInput(input) {
  const commentText = normalize(input.comment_text);
  const errors = {};

  if (commentText.length < 1 || commentText.length > 2000) {
    errors.comment_text = "Comment must be between 1 and 2000 characters.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    values: {
      comment_text: commentText,
    },
    errors,
  };
}

export function validateReviewInput(input) {
  const ratingRaw = normalize(input.rating);
  const reviewText = normalize(input.review_text);
  const errors = {};

  let rating = null;
  if (ratingRaw === "") {
    errors.rating = "Rating is required.";
  } else {
    const parsed = Number.parseInt(ratingRaw, 10);
    if (!/^\d+$/.test(ratingRaw) || !Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      errors.rating = "Rating must be a whole number between 1 and 5.";
    } else {
      rating = parsed;
    }
  }

  if (reviewText.length > 2000) {
    errors.review_text = "Review text must be 2000 characters or fewer.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    values: {
      rating,
      review_text: reviewText,
    },
    errors,
  };
}
