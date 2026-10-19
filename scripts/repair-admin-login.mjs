// Atualiza apenas o hash de login administrativo no D1, sem colocar a senha
// no histórico do PowerShell, arquivos do projeto ou GitHub.
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function secureInput(label) {
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    const terminal = Boolean(process.stdin.isTTY && process.stdin.setRawMode);
    if (terminal) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const cleanup = () => {
      process.stdin.off("data", onData);
      if (terminal) process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = chunk => {
      for (const char of chunk) {
        if (char === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          reject(new Error("Operação cancelada."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\b" || char === "\u007f") {
          value = value.slice(0, -1);
        } else if (char >= " " && value.length < 256) {
          value += char;
        }
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const password = await secureInput("Digite a senha administrativa (não será exibida): ");
  if (password.length < 12) throw new Error("A senha deve conter pelo menos 12 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const digest = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
  const folder = mkdtempSync(join(tmpdir(), "rioverde-auth-"));
  const sqlPath = join(folder, "auth.sql");
  try {
    const sql = [
      "UPDATE admin_settings SET",
      "  password_salt = '" + salt + "',",
      "  password_hash = '" + digest + "',",
      "  revision = lower(hex(randomblob(16))),",
      "  updated_at = datetime('now')",
      "WHERE id = 1;"
    ].join("\n");
    writeFileSync(sqlPath, sql, { encoding: "utf8", mode: 0o600, flag: "wx" });
    const command = process.platform === "win32" ? "cmd.exe" : "npx";
    const args = process.platform === "win32"
      ? ["/d", "/s", "/c", 'npx wrangler d1 execute rioverde-editorial --remote --file "' + sqlPath + '"']
      : ["wrangler", "d1", "execute", "rioverde-editorial", "--remote", "--file", sqlPath];
    const result = spawnSync(command, args, {
      cwd: join(import.meta.dirname, ".."),
      encoding: "utf8", timeout: 120000, windowsHide: true,
      maxBuffer: 512000
    });
    if (result.error || result.status !== 0) {
      throw new Error("Falha ao atualizar o D1: " + String(result.stderr || result.error || result.stdout).slice(-1500));
    }
    console.log("Hash atualizado no banco remoto, sem alteração do usuário e sem publicar a senha.");
    console.log("O script preservou todos os dados e revogou sessões anteriores.");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
