import { test, expect } from "@playwright/test";

test("resident can login from homepage and logout", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Helpdesk" })).toBeVisible();
  await page.getByLabel("Username").fill("resident_flat101");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page).toHaveURL(/\/resident$/);
  await expect(page.getByRole("heading", { name: "Resident Home (All Tickets)" })).toBeVisible();
  await expect(page.getByText("Apartment: Palm Meadows")).toBeVisible();
  await expect(page.getByText("Flat: 101")).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Ticket" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Ticket" })).toHaveCount(0);
  await expect(page.locator("nav").getByRole("button", { name: "Logout" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/\?reason=logged_out$/);
  await expect(page.getByText("You have been logged out.")).toBeVisible();
});

test("admin and staff are routed to their role homes", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("admin_pm");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Home (All Tickets)" })).toBeVisible();
  await expect(page.getByText("Apartment: Palm Meadows")).toBeVisible();
  await expect(page.getByText("Flat: N/A (Admin account)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin Account" })).toHaveCount(0);

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/\?reason=logged_out$/);

  await page.getByLabel("Username").fill("staff_electric_1");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("heading", { name: "Staff Home (Assigned Tickets)" })).toBeVisible();
});
