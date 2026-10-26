import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CLIENT_IP_HEADER, UNKNOWN_CLIENT_IP, clientIpKey } from "./client-ip";

/**
 * 回数制限の数え先（DD-032 の3）。
 * Cloudflare が付ける1つのヘッダーだけを信じ、利用者が書き換えられるヘッダーは見ない。
 * IPv6 は /64 にまとめ、同じ回線の中で番号を変えて数え直させない。
 */

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("clientIpKey", () => {
  it("数え先のヘッダーは cf-connecting-ip", () => {
    expect(CLIENT_IP_HEADER).toBe("cf-connecting-ip");
  });

  it("IPv4 はそのまま使う", () => {
    expect(clientIpKey(headers({ "cf-connecting-ip": "192.0.2.10" }))).toBe("192.0.2.10");
    expect(clientIpKey(headers({ "cf-connecting-ip": " 192.0.2.10 " }))).toBe("192.0.2.10");
  });

  it("IPv6 は先頭の64ビットにまとめる", () => {
    expect(clientIpKey(headers({ "cf-connecting-ip": "2001:db8:1:2:3:4:5:6" }))).toBe("2001:db8:1:2::/64");
    expect(clientIpKey(headers({ "cf-connecting-ip": "2001:0DB8:0001:0002::1" }))).toBe("2001:db8:1:2::/64");
    expect(clientIpKey(headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8:0:0::/64");
    // :: が先頭か末尾にあっても、8つの組に展開してから先頭の4つを取る
    expect(clientIpKey(headers({ "cf-connecting-ip": "::1" }))).toBe("0:0:0:0::/64");
    expect(clientIpKey(headers({ "cf-connecting-ip": "2001:db8:1:2::" }))).toBe("2001:db8:1:2::/64");
  });

  it("同じ /64 の中の別の番号は同じ数え先になる", () => {
    const a = clientIpKey(headers({ "cf-connecting-ip": "2001:db8:1:2::aaaa" }));
    const b = clientIpKey(headers({ "cf-connecting-ip": "2001:db8:1:2:ffff:ffff:ffff:ffff" }));
    expect(a).toBe(b);
  });

  it("IPv4 を写した IPv6 の形は IPv4 として数える", () => {
    expect(clientIpKey(headers({ "cf-connecting-ip": "::ffff:192.0.2.10" }))).toBe("192.0.2.10");
  });

  it("壊れた値・複数の値・ヘッダーが無いときは共通の1つの入れ物で数える", () => {
    for (const value of [
      "",
      "abc",
      "999.1.1.1",
      "192.0.2",
      "192.0.2.10, 198.51.100.1",
      "2001:db8:::1",
      "1.2.3.4.5",
      // :: が2か所ある・5桁の組・組の数が合わない・IPv4 を写した形の中の壊れた IPv4
      "2001::db8::1",
      "12345::1",
      "1:2:3:4:5:6:7",
      "1:2:3:4::5:6:7:8",
      "::ffff:999.0.2.10",
    ]) {
      expect(clientIpKey(headers({ "cf-connecting-ip": value })), value).toBe(UNKNOWN_CLIENT_IP);
    }
    expect(clientIpKey(headers({}))).toBe(UNKNOWN_CLIENT_IP);
  });

  it("x-forwarded-for と x-real-ip は見ない", () => {
    expect(clientIpKey(headers({ "x-forwarded-for": "192.0.2.10" }))).toBe(UNKNOWN_CLIENT_IP);
    expect(clientIpKey(headers({ "x-real-ip": "192.0.2.10" }))).toBe(UNKNOWN_CLIENT_IP);
    expect(
      clientIpKey(
        headers({ "cf-connecting-ip": "198.51.100.7", "x-forwarded-for": "192.0.2.10", "x-real-ip": "192.0.2.11" }),
      ),
    ).toBe("198.51.100.7");
  });
});

describe("ヘッダーを読む場所", () => {
  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(path);
    }
    return out;
  }

  it("src の中で数え先のヘッダーの名前を書くのは client-ip.ts だけ", () => {
    const root = process.cwd();
    const hits = sourceFiles(join(root, "src"))
      .filter((path) => /cf-connecting-ip|x-forwarded-for|x-real-ip/i.test(readFileSync(path, "utf8")))
      .map((path) => relative(root, path));
    expect(hits).toEqual(["src/lib/security/client-ip.ts"]);
  });
});
