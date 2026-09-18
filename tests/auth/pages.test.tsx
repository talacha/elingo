import { describe, expect, it } from "vitest";

// These are client components that are rendered on the browser side.
// Import them to ensure they exist and can be loaded without errors.
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { ProfileForm } from "@/components/auth/ProfileForm";

describe("Auth Components", () => {
  it("LoginForm component exists", () => {
    expect(LoginForm).toBeDefined();
    expect(typeof LoginForm).toBe("function");
  });

  it("SignupForm component exists", () => {
    expect(SignupForm).toBeDefined();
    expect(typeof SignupForm).toBe("function");
  });

  it("ProfileForm component exists", () => {
    expect(ProfileForm).toBeDefined();
    expect(typeof ProfileForm).toBe("function");
  });
});
