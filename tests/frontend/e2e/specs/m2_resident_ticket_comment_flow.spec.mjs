import { test, expect } from "@playwright/test";

test("resident can create a ticket and add a comment from ticket detail", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const ticketTitle = `Balcony light switch sparks ${suffix}`;
  const ticketDescription = `The balcony light switch creates sparks when turned on and needs repair. ${suffix}`;

  await page.goto("/");

  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/resident$/);
  await page.getByRole("button", { name: "Create Ticket" }).click();

  await expect(page).toHaveURL(/\/tickets\/new\??$/);
  await page.getByRole("radio", { name: "Electrical" }).check();
  await page.getByLabel("Title").fill(ticketTitle);
  await page.getByLabel("Description").fill(ticketDescription);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  const ticketPath = new URL(page.url()).pathname;
  await expect(page.locator(".resident-meta").filter({ hasText: ticketTitle })).toBeVisible();
  await expect(page.getByText("Ticket created")).toBeVisible();

  await page.getByLabel("Add Comment").fill("Please visit after 6 PM.");
  await page.getByRole("button", { name: "Add Comment" }).click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  await expect(page.getByText("Please visit after 6 PM.")).toBeVisible();

  await page.getByRole("link", { name: /Home/ }).click();
  await expect(page).toHaveURL(/\/resident$/);
  await expect(page.locator(".ticket-item").filter({ hasText: ticketTitle }).first()).toBeVisible();

  await page.getByRole("link", { name: /Profile/ }).click();
  await expect(page).toHaveURL(/\/resident\/account$/);
  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("admin_pm");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(ticketPath);
  await page.getByLabel("Cancellation Reason").fill(`Cleanup completion for e2e run ${suffix}.`);
  await page.getByRole("button", { name: "Complete Ticket as Cancelled/Duplicate" }).click();
  await expect(page.getByText(/Status:\s*Completed/i)).toBeVisible();
});
