import { test, expect } from "@playwright/test";

test("resident can create a ticket and add a comment from ticket detail", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/resident$/);
  await page.getByRole("button", { name: "Create Ticket" }).click();

  await expect(page).toHaveURL(/\/tickets\/new\??$/);
  await page.getByLabel("Issue Type").selectOption("electrical");
  await page.getByLabel("Title").fill("Balcony light switch sparks");
  await page
    .getByLabel("Description")
    .fill("The balcony light switch creates sparks when turned on and needs repair.");
  await page.getByRole("button", { name: "Create Ticket" }).click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  await expect(page.getByText("Balcony light switch sparks")).toBeVisible();
  await expect(page.getByText("Ticket created")).toBeVisible();

  await page.getByLabel("Add Comment").fill("Please visit after 6 PM.");
  await page.getByRole("button", { name: "Add Comment" }).click();

  await expect(page).toHaveURL(/\/tickets\/\d+$/);
  await expect(page.getByText("Please visit after 6 PM.")).toBeVisible();

  await page.getByRole("link", { name: /Resident Home \(All Tickets\)/ }).click();
  await expect(page).toHaveURL(/\/resident$/);
  await expect(page.getByText("Balcony light switch sparks")).toBeVisible();
});
