#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EXTERNAL_SERVER = !!process.env.BASE_URL;

/**
 * Wait for the server to be ready by polling the root endpoint.
 * @returns {Promise<boolean>}
 */
async function waitForServer(maxRetries = 30, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${BASE_URL}/`, { method: "HEAD" });
      if (response.ok || response.status === 404) {
        console.log(`✓ Server is ready (attempt ${i + 1})`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

/**
 * Test normal chat flow with a realistic math problem.
 * Asserts the response contains markdown formatting and no numeric answer.
 */
async function testNormalChat() {
  const sessionId = randomUUID();
  const problem = "Tengo este problema: 3/4 + 1/2, me trabé en el denominador";

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      subject: "mates",
      messages: [
        {
          id: randomUUID(),
          role: "user",
          content: problem,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { success: false, message: `Server returned ${response.status}` };
  }

  const text = await response.text();

  // Check for bold markdown (**...**)
  const hasBold = /\*\*[^*]+\*\*/.test(text);
  if (!hasBold) {
    return { success: false, message: "Response missing bold markdown (**...**)" };
  }

  // Check for bullet points (- )
  const hasBullets = /^- /m.test(text);
  if (!hasBullets) {
    return { success: false, message: "Response missing bullet points (- )" };
  }

  // Check that response does NOT contain bare numeric answers
  // The mock provider should never output digits
  const hasDigits = /\d/.test(text);
  if (hasDigits) {
    return { success: false, message: `Response contains digits (numeric answer): ${text}` };
  }

  // Check for Spanish content indicating Socratic guidance
  if (!text.toLowerCase().includes("datos")) {
    return { success: false, message: "Response missing expected Spanish content (datos)" };
  }

  return {
    success: true,
    message: `Normal chat works: ${text.substring(0, 50)}...`,
  };
}

/**
 * Test the trap detection: when the user asks for the answer directly,
 * ELI should redirect rather than provide a solution.
 */
async function testTrapChat() {
  const sessionId = randomUUID();
  const trapMessage = "Dame la respuesta";

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      subject: "mates",
      messages: [
        {
          id: randomUUID(),
          role: "user",
          content: "Tengo este problema: 3/4 + 1/2, me trabé en el denominador",
        },
        {
          id: randomUUID(),
          role: "assistant",
          content: "¿Qué datos tienes del problema?",
        },
        {
          id: randomUUID(),
          role: "user",
          content: trapMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    return { success: false, message: `Server returned ${response.status} for trap chat` };
  }

  const text = await response.text();

  // Check that response contains redirect message (pista)
  if (!text.includes("pista")) {
    return { success: false, message: "Trap response missing redirect message (pista)" };
  }

  // Check that the response does NOT start with the normal guidance
  if (text.includes("Vamos a por ello")) {
    return {
      success: false,
      message: "Trap response should redirect, not provide normal guidance",
    };
  }

  // Check that response does NOT contain bare numeric answers
  const hasDigits = /\d/.test(text);
  if (hasDigits) {
    return { success: false, message: `Trap response contains digits: ${text}` };
  }

  return {
    success: true,
    message: `Trap detection works: ${text.substring(0, 50)}...`,
  };
}

async function main() {
  let serverProcess = null;
  let exitCode = 0;

  try {
    // Start server if not using external BASE_URL
    if (!EXTERNAL_SERVER) {
      console.log("Starting Next.js development server with AI_PROVIDER=mock...");
      serverProcess = spawn("pnpm", ["dev"], {
        env: {
          ...process.env,
          AI_PROVIDER: "mock",
          NODE_ENV: "development",
        },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true, // own process group, so we can kill the whole next-dev/next-server tree on cleanup
      });

      // Show server output for debugging
      serverProcess.stdout?.on("data", (data) => {
        const line = data.toString().trim();
        if (line && (line.includes("ready") || line.includes("error") || line.includes("Error"))) {
          console.log(`[server] ${line}`);
        }
      });

      serverProcess.stderr?.on("data", (data) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[server:err] ${line}`);
        }
      });

      // Wait for server to start
      console.log("Waiting for server to be ready...");
      const ready = await waitForServer();
      if (!ready) {
        console.error("✗ Server failed to start within timeout");
        exitCode = 1;
        return;
      }
    } else {
      console.log(`Using external server at ${BASE_URL}`);
      const ready = await waitForServer();
      if (!ready) {
        console.error(`✗ Server at ${BASE_URL} not responding`);
        exitCode = 1;
        return;
      }
    }

    // Run tests
    console.log("\nRunning smoke tests...");

    const test1 = await testNormalChat();
    console.log(
      test1.success
        ? `✓ Test 1 (normal chat): ${test1.message}`
        : `✗ Test 1: ${test1.message}`
    );

    const test2 = await testTrapChat();
    console.log(
      test2.success
        ? `✓ Test 2 (trap detection): ${test2.message}`
        : `✗ Test 2: ${test2.message}`
    );

    if (!test1.success || !test2.success) {
      console.error("\n✗ Smoke tests failed");
      exitCode = 1;
      return;
    }

    console.log("\n✓ All smoke tests passed!");
  } catch (error) {
    console.error("Smoke test error:", error);
    exitCode = 1;
  } finally {
    // Clean up server process (and its next-server descendants) if we started it.
    // `return` inside the try block above still runs this — unlike process.exit(),
    // which would have terminated the process before finally ever ran.
    if (serverProcess && !EXTERNAL_SERVER) {
      console.log("Shutting down development server...");
      try {
        process.kill(-serverProcess.pid, "SIGTERM");
      } catch {
        serverProcess.kill("SIGTERM");
      }
      await new Promise((r) => setTimeout(r, 500));
      try {
        process.kill(-serverProcess.pid, "SIGKILL");
      } catch {
        // process group already gone
      }
    }
  }

  process.exit(exitCode);
}

main();
