const fs = require("fs");
const path = require("path");
const { EMPTY_STORE, STORE_PATH, DATA_DIR } = require("../src/localStore");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

fs.writeFileSync(STORE_PATH, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
console.log(`Reset local data at ${STORE_PATH}`);
