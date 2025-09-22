import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import fetch from "node-fetch";

/**
 * Development Server Integration Tests
 *
 * These tests verify that the development server starts correctly
 * and responds to basic requests. Run with: npm run test
 */

describe("Development Server", () => {
  let devServer: any;
  const DEV_PORT = 3001;
  const BASE_URL = `http://localhost:${DEV_PORT}`;

  beforeAll(async () => {
    // Start the dev server
    devServer = spawn("npm", ["run", "dev"], {
      stdio: "pipe",
      detached: false,
    });

    // Wait for server to be ready
    let serverReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    while (!serverReady && attempts < maxAttempts) {
      try {
        const response = await fetch(BASE_URL);
        if (response.status === 200) {
          serverReady = true;
        }
      } catch (error) {
        // Server not ready yet
      }

      if (!serverReady) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (!serverReady) {
      throw new Error("Development server failed to start within 30 seconds");
    }
  }, 45000); // 45 second timeout

  afterAll(async () => {
    if (devServer) {
      devServer.kill("SIGTERM");

      // Wait for graceful shutdown
      await new Promise((resolve) => {
        devServer.on("exit", resolve);
        setTimeout(resolve, 5000); // Force kill after 5 seconds
      });
    }
  });

  it("should start and respond on localhost:3001", async () => {
    const response = await fetch(BASE_URL);
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("EMR Chat"); // Should contain the app title
  });

  it("should serve the favicon correctly", async () => {
    const response = await fetch(`${BASE_URL}/favicon.ico`);
    expect(response.status).toBe(200);
  });

  it("should handle API routes correctly", async () => {
    const response = await fetch(`${BASE_URL}/api/faculty/settings`);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("scenarioId");
    expect(data).toHaveProperty("enableClientScenario");
  });

  it("should return proper content-type headers", async () => {
    const htmlResponse = await fetch(BASE_URL);
    expect(htmlResponse.headers.get("content-type")).toContain("text/html");

    const apiResponse = await fetch(`${BASE_URL}/api/faculty/settings`);
    expect(apiResponse.headers.get("content-type")).toContain(
      "application/json"
    );
  });

  it("should handle 404 routes correctly", async () => {
    const response = await fetch(`${BASE_URL}/non-existent-route`);
    expect(response.status).toBe(404);
  });

  it("should support hot reload (development mode check)", async () => {
    const response = await fetch(BASE_URL);
    const html = await response.text();

    // In development mode, Next.js includes webpack HMR scripts
    expect(html).toContain("webpack"); // Should contain webpack references for HMR
  });

  it("should respond quickly to requests", async () => {
    const startTime = Date.now();
    const response = await fetch(BASE_URL);
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(5000); // Should respond within 5 seconds
  });
});
