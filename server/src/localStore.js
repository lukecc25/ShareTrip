const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_PATH = path.join(DATA_DIR, "local-store.json");

const EMPTY_STORE = {
  accounts: [],
  rides: [],
  passengers: [],
  comments: [],
  ratings: [],
  driver_offers: [],
  notifications: [],
  counters: {
    rides: 0,
    passengers: 0,
    comments: 0,
    ratings: 0,
    driver_offers: 0,
    notifications: 0,
  },
};

let store = null;
let writeChain = Promise.resolve();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStoreSync() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) {
    store = structuredClone(EMPTY_STORE);
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
    return store;
  }

  const parsed = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  store = {
    ...structuredClone(EMPTY_STORE),
    ...parsed,
    counters: { ...EMPTY_STORE.counters, ...(parsed.counters || {}) },
  };
  return store;
}

function saveStoreSync() {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function queue(fn) {
  writeChain = writeChain.then(fn, fn);
  return writeChain;
}

function now() {
  return new Date().toISOString();
}

function nextId(counterKey) {
  store.counters[counterKey] = (store.counters[counterKey] || 0) + 1;
  return store.counters[counterKey];
}

async function readStore() {
  return queue(() => {
    loadStoreSync();
    return structuredClone(store);
  });
}

async function mutate(mutator) {
  return queue(() => {
    loadStoreSync();
    const result = mutator(store);
    saveStoreSync();
    return result;
  });
}

module.exports = {
  STORE_PATH,
  DATA_DIR,
  readStore,
  mutate,
  now,
  nextId,
  EMPTY_STORE,
};
