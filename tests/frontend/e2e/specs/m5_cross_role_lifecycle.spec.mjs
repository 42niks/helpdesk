import { test, expect } from "@playwright/test";

test("admin assignment, staff completion, and resident review flow", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const ticketTitle = `Balcony light tube flickers repeatedly ${suffix}`;
  const ticketDescription = `The balcony light tube keeps flickering and needs electrician support. ${suffix}`;
  const reviewText = `Great and fast electrical repair ${suffix}.`;
  const staffComment = `Staff update before completion ${suffix}.`;

  const staffRatingCount = async () => {
    const staffCard = page.locator(".ticket-item").filter({
      has: page.getByRole("heading", { name: "Electric Staff" }),
    }).first();
    await expect(staffCard).toBeVisible();
    const cardText = (await staffCard.textContent()) || "";
    const match = cardText.match(/(\d+)\s+ratings/i);
    if (!match) {
      throw new Error("Could not extract staff rating count from resident ratings page.");
    }
    return Number.parseInt(match[1], 10);
  };

  await page.goto("/");
  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/resident$/);

  await page.goto("/resident/staff-ratings");
  const ratingCountBefore = await staffRatingCount();
  await page.goto("/resident");

  await page.getByRole("button", { name: "Create Ticket" }).click();
  await page.getByRole("radio", { name: "Electrical" }).check();
  await page.getByLabel("Title").fill(ticketTitle);
  await page.getByLabel("Description").fill(ticketDescription);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  const ticketPath = new URL(page.url()).pathname;

  await page.getByRole("link", { name: /Profile/ }).click();
  await expect(page).toHaveURL(/\/resident\/account$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("admin_pm");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator(".ticket-item").filter({ hasText: ticketTitle }).first()).toBeVisible();

  await page.goto(ticketPath);
  await expect(page).toHaveURL(new RegExp(`${ticketPath}$`));

  await page.getByLabel("Assign Staff").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save Assignment" }).click();
  await expect(page.getByRole("heading", { name: "Assigned Staff" })).toBeVisible();
  await expect(page.getByText(/Name:\s*Electric Staff/i)).toBeVisible();

  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/admin\/account$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("staff_electric_1");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/staff$/);

  await page.goto(ticketPath);
  await expect(page).toHaveURL(new RegExp(`${ticketPath}$`));

  await page.getByLabel("Add Comment").fill(staffComment);
  await page.getByRole("button", { name: "Add Comment" }).click();
  await expect(page.getByText(staffComment)).toBeVisible();

  await page.getByLabel("Next Status").selectOption("in_progress");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Status:\s*In Progress/i)).toBeVisible();

  await page.getByLabel("Next Status").selectOption("completed");
  await page.getByRole("button", { name: "Update Status" }).click();
  await expect(page.getByText(/Status:\s*Completed/i)).toBeVisible();

  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/staff\/account$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/resident$/);

  await page.goto(ticketPath);
  await expect(page).toHaveURL(new RegExp(`${ticketPath}$`));
  await page.getByLabel("Rating (optional)").selectOption("5");
  await page.getByLabel("Review Text (optional)").fill(reviewText);
  await page.getByRole("button", { name: "Submit Review" }).click();
  await expect(page.getByText(reviewText)).toBeVisible();

  await page.goto("/resident/staff-ratings");
  await expect(page).toHaveURL(/\/resident\/staff-ratings$/);
  await expect(page.getByRole("heading", { name: "Electric Staff" })).toBeVisible();
  const ratingCountAfter = await staffRatingCount();
  await expect(ratingCountAfter).toBe(ratingCountBefore + 1);
  await page.getByRole("link", { name: "View Reviews" }).first().click();
  await expect(page).toHaveURL(/\/resident\/staff-ratings\/\d+$/);
  await expect(page.getByText(reviewText)).toBeVisible();
});
