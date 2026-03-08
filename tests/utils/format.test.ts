import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  formatSOL,
  formatUSD,
  truncateAddress,
  timeAgo,
  lamportsToSOL,
  solToLamports,
} from "../../src/utils/format";

describe("formatSOL", () => {
  it("formats zero lamports", () => {
    expect(formatSOL(0)).toBe("0.000000 SOL");
  });

  it("formats sub-0.001 SOL with 6 decimal places", () => {
    expect(formatSOL(100_000)).toBe("0.000100 SOL");
    expect(formatSOL(1)).toBe("0.000000 SOL");
    expect(formatSOL(500_000)).toBe("0.000500 SOL");
  });

  it("formats 0.001–1 SOL with 4 decimal places", () => {
    expect(formatSOL(5_000_000)).toBe("0.0050 SOL"); // 0.005 SOL (default vouch)
    expect(formatSOL(100_000_000)).toBe("0.1000 SOL");
    expect(formatSOL(999_000_000)).toBe("0.9990 SOL");
  });

  it("formats >= 1 SOL with 2 decimal places", () => {
    expect(formatSOL(LAMPORTS_PER_SOL)).toBe("1.00 SOL");
    expect(formatSOL(5 * LAMPORTS_PER_SOL)).toBe("5.00 SOL"); // max vouch
    expect(formatSOL(1_500_000_000)).toBe("1.50 SOL");
  });

  it("handles the default vouch amount (5,000,000 lamports = 0.005 SOL)", () => {
    expect(formatSOL(5_000_000)).toBe("0.0050 SOL");
  });

  it("handles the max vouch amount (5 SOL)", () => {
    expect(formatSOL(5_000_000_000)).toBe("5.00 SOL");
  });
});

describe("formatUSD", () => {
  it("converts lamports to USD at given SOL price", () => {
    // 1 SOL at $100
    expect(formatUSD(LAMPORTS_PER_SOL, 100)).toBe("$100.00");
  });

  it("handles fractional SOL amounts", () => {
    // 0.005 SOL at $200 = $1.00
    expect(formatUSD(5_000_000, 200)).toBe("$1.00");
  });

  it("handles zero lamports", () => {
    expect(formatUSD(0, 150)).toBe("$0.00");
  });
});

describe("truncateAddress", () => {
  const fullAddress = "HDvUruses5D2tPCUZnhkLiR4GB2B49GwkpjJJUKjCAvw";

  it("truncates long addresses with default chars=4", () => {
    const result = truncateAddress(fullAddress);
    expect(result).toBe("HDvU...CAvw");
    expect(result.length).toBeLessThan(fullAddress.length);
  });

  it("truncates with custom char count", () => {
    expect(truncateAddress(fullAddress, 6)).toBe("HDvUru...KjCAvw");
    expect(truncateAddress(fullAddress, 8)).toBe("HDvUruse...JUKjCAvw");
  });

  it("returns short addresses unchanged", () => {
    expect(truncateAddress("abc", 4)).toBe("abc");
  });

  it("returns addresses exactly at threshold unchanged", () => {
    // chars * 2 + 3 = 11 for chars=4
    expect(truncateAddress("12345678901")).toBe("12345678901");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3d ago");
  });

  it("returns months ago", () => {
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoMonthsAgo)).toBe("2mo ago");
  });
});

describe("lamportsToSOL / solToLamports", () => {
  it("converts lamports to SOL", () => {
    expect(lamportsToSOL(LAMPORTS_PER_SOL)).toBe(1);
    expect(lamportsToSOL(500_000_000)).toBe(0.5);
    expect(lamportsToSOL(0)).toBe(0);
  });

  it("converts SOL to lamports", () => {
    expect(solToLamports(1)).toBe(LAMPORTS_PER_SOL);
    expect(solToLamports(0.5)).toBe(500_000_000);
    expect(solToLamports(0)).toBe(0);
  });

  it("round-trips correctly", () => {
    const lamports = 123_456_789;
    expect(solToLamports(lamportsToSOL(lamports))).toBe(lamports);
  });

  it("rounds fractional lamports", () => {
    // 0.0000000015 SOL → 1.5 lamports → rounds to 2
    expect(solToLamports(0.0000000015)).toBe(2);
    // 0.000000005 SOL → 5 lamports (exact)
    expect(solToLamports(0.000000005)).toBe(5);
  });
});
