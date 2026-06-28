/** 完整登录：获取二维码 → 等待扫码 → 保存凭证 */
import { login } from "./login.js";
import { saveCredentials } from "./config.js";

console.log("========================================");
console.log("  WeChat Claude Bridge - 登录");
console.log("========================================\n");

async function main() {
  const result = await login();
  saveCredentials({
    token: result.token,
    accountId: result.accountId,
    baseUrl: result.baseUrl,
    userId: result.userId,
  });
  console.log("\n✅ 凭证已保存！");
  console.log(`   accountId: ${result.accountId}`);
  console.log(`   userId: ${result.userId}`);
  console.log(`\n现在你可以运行: npx tsx src/index.ts`);
}

main().catch((err) => {
  console.error("\n❌ 登录失败:", err.message);
  process.exit(1);
});
