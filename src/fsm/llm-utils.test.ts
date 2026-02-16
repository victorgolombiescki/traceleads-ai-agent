// Tests disabled - vitest not configured
// import { describe, it, expect } from "vitest";
import { isValidEmail, isValidPhone, formatPhone } from "./llm-utils";

describe("LLM Utils - Validation", () => {
  describe("isValidEmail", () => {
    it("should validate correct email addresses", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("test.user@domain.co.uk")).toBe(true);
      expect(isValidEmail("name+tag@company.com")).toBe(true);
    });

    it("should reject invalid email addresses", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("user @example.com")).toBe(false);
      expect(isValidEmail("")).toBe(false);
    });
  });

  describe("isValidPhone", () => {
    it("should validate Brazilian phone numbers with 10 digits", () => {
      expect(isValidPhone("1198765432")).toBe(true);
      expect(isValidPhone("(11) 9876-5432")).toBe(true);
    });

    it("should validate Brazilian phone numbers with 11 digits", () => {
      expect(isValidPhone("11987654321")).toBe(true);
      expect(isValidPhone("(11) 98765-4321")).toBe(true);
    });

    it("should reject invalid phone numbers", () => {
      expect(isValidPhone("123")).toBe(false);
      expect(isValidPhone("")).toBe(false);
      expect(isValidPhone("abc")).toBe(false);
    });
  });

  describe("formatPhone", () => {
    it("should format 11-digit phone numbers", () => {
      expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
      expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321");
    });

    it("should format 10-digit phone numbers", () => {
      expect(formatPhone("1198765432")).toBe("(11) 9876-5432");
      expect(formatPhone("(11) 9876-5432")).toBe("(11) 9876-5432");
    });

    it("should return original if format is invalid", () => {
      expect(formatPhone("123")).toBe("123");
      expect(formatPhone("abc")).toBe("abc");
    });
  });
});
