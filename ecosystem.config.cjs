const fs = require("fs");
const path = require("path");
const dotenv = fs.readFileSync(path.join(__dirname, ".env"), "utf-8");
const env = {};
for (const line of dotenv.split("\n")) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

module.exports = {
  apps: [{
    name: "uu-bridge",
    script: "src/index.ts",
    interpreter: "node",
    interpreter_args: "--import tsx/esm",
    args: "--char uu",
    cwd: __dirname,
    env,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    log_date_format: "MM-DD HH:mm:ss",
  }]
};
