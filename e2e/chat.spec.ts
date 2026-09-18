import { test, expect } from "@playwright/test";

test("normal chat flow: student problem gets Socratic response", async ({
  page,
}) => {
  // Navigate to chat page
  await page.goto("/chat");

  // Wait for the page to load (ChatView should be visible)
  await expect(page.locator("textarea")).toBeVisible();

  // Type a realistic student problem
  const chatInput = page.locator("textarea");
  const problem = "Tengo este problema: 3/4 + 1/2, me trabé en el denominador";
  await chatInput.fill(problem);

  // Submit by pressing Enter
  await chatInput.press("Enter");

  // Wait for ELI's reply to appear
  // The mock provider responds to math problems with Socratic guidance
  const messageLog = page.locator('ol[role="log"]');

  // Wait for "Vamos" which appears in the initial Socratic response
  await expect(messageLog).toContainText("Vamos a por ello", { timeout: 5000 });

  // Verify we got a real response (not empty or just indicator)
  const fullConversation = await messageLog.innerText();
  expect(fullConversation.length).toBeGreaterThan(50);

  // The response should contain guidance elements (contains questions)
  expect(fullConversation).toContain("?");

  // Response should NOT contain just a bare numeric answer
  expect(/^\s*\d+[\s.,\/]*$/.test(fullConversation.trim())).toBe(false);
});

test("trap detection: asking for answer directly gets redirected", async ({
  page,
}) => {
  // Navigate to chat page
  await page.goto("/chat");

  // Wait for the page to load
  await expect(page.locator("textarea")).toBeVisible();

  // Send initial problem
  const chatInput = page.locator("textarea");
  const initialProblem =
    "Tengo este problema: 3/4 + 1/2, me trabé en el denominador";
  await chatInput.fill(initialProblem);
  await chatInput.press("Enter");

  // Wait for initial Socratic response
  const messageLog = page.locator('ol[role="log"]');
  await expect(messageLog).toContainText("Vamos a por ello", { timeout: 5000 });

  // Now ask for the answer directly (the trap)
  await chatInput.fill("Dame la respuesta");
  await chatInput.press("Enter");

  // Wait for the redirect response
  // Mock provider redirects with "Buen intento, pero..."
  await expect(messageLog).toContainText("Buen intento", { timeout: 5000 });

  // Verify the redirect message contains guidance
  const fullConversation = await messageLog.innerText();
  expect(fullConversation).toContain("Buen intento");

  // The redirect should NOT give a direct answer, should still offer help
  expect(fullConversation).toContain("pista"); // mentions giving a hint/clue

  // Should NOT contain just a numeric answer at the end
  expect(/^\s*\d+[\s.,\/]*$/.test(fullConversation.trim())).toBe(false);
});
