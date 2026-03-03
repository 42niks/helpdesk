import { test, expect } from "@playwright/test";

test("admin assignment, staff completion, and resident review flow", async ({ page }) => {
  const ticketTitle = "Balcony light tube flickers repeatedly";
  const ticketDescription = "The balcony light tube keeps flickering and needs electrician support.";
  const reviewText = "Great and fast electrical repair.";

  await page.goto("/");
  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/resident$/);

  await page.getByRole("button", { name: "Create Ticket" }).click();
  await page.getByLabel("Issue Type").selectOption("electrical");
  await page.getByLabel("Title").fill(ticketTitle);
  await page.getByLabel("Description").fill(ticketDescription);
  await page.getByRole("button", { name: "Create Ticket" }).click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);

  await page.locator("nav").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("admin_pm");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(ticketTitle)).toBeVisible();

  await page.locator('a[href^="/tickets/"]').first().click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);

  await page.getByLabel("Assign Staff").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save Assignment" }).click();
  await expect(page.getByRole("heading", { name: "Assigned Staff" })).toBeVisible();
  await expect(page.getByText(/Name:\s*Electric Staff/i)).toBeVisible();

  await page.locator("nav").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("staff_electric_1");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/staff$/);

  await page.locator('a[href^="/tickets/"]').first().click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);

  await page.getByLabel("Next Status").selectOption("in_progress");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Status:\s*In Progress/i)).toBeVisible();

  await page.getByLabel("Next Status").selectOption("completed");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Status:\s*Completed/i)).toBeVisible();

  await page.locator("nav").getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/resident$/);

  await page.locator('a[href^="/tickets/"]').first().click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  await page.getByLabel("Rating (optional)").selectOption("5");
  await page.getByLabel("Review Text (optional)").fill(reviewText);
  await page.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByText(reviewText)).toBeVisible();

  await page.goto("/resident/staff-ratings");
  await expect(page).toHaveURL(/\/resident\/staff-ratings$/);
  await expect(page.getByRole("heading", { name: "Electric Staff" })).toBeVisible();
  await expect(page.getByText(reviewText)).toBeVisible();
});
