const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { readStore, mutate, now } = require("./localStore");

const PUBLIC_FIELDS = [
  "id",
  "fname",
  "lname",
  "email",
  "phone",
  "gender",
  "able_driver",
  "created_at",
  "updated_at",
];

function pickPublic(account) {
  if (!account) {
    return null;
  }
  const row = {};
  for (const key of PUBLIC_FIELDS) {
    row[key] = account[key];
  }
  return row;
}

async function getAccountById(id) {
  const data = await readStore();
  return pickPublic(data.accounts.find((a) => a.id === id));
}

async function getAccountByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const data = await readStore();
  return data.accounts.find((a) => a.email === normalized) || null;
}

async function createAccount({ fname, lname, email, phone, gender, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);

  return mutate((store) => {
    if (store.accounts.some((a) => a.email === normalizedEmail)) {
      throw new Error("An account with that email already exists.");
    }

    const timestamp = now();
    const account = {
      id: randomUUID(),
      fname,
      lname,
      email: normalizedEmail,
      phone: phone ?? null,
      gender,
      password_hash: passwordHash,
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.accounts.push(account);
    return pickPublic(account);
  });
}

async function verifyLogin(email, password) {
  const account = await getAccountByEmail(email);
  if (!account) {
    return null;
  }
  const valid = await bcrypt.compare(password, account.password_hash);
  if (!valid) {
    return null;
  }
  return getAccountById(account.id);
}

async function updateAccount(id, data) {
  return mutate((store) => {
    const index = store.accounts.findIndex((a) => a.id === id);
    if (index < 0) {
      throw new Error("Account not found.");
    }

    const current = store.accounts[index];
    store.accounts[index] = {
      ...current,
      fname: data.fname,
      lname: data.lname,
      email: data.email.trim().toLowerCase(),
      phone: data.phone ?? null,
      gender: data.gender,
      able_driver:
        data.able_driver !== undefined
          ? data.able_driver
            ? 1
            : 0
          : (current.able_driver ?? 1),
      updated_at: now(),
    };
    return pickPublic(store.accounts[index]);
  });
}

module.exports = {
  pickPublic,
  getAccountById,
  getAccountByEmail,
  createAccount,
  verifyLogin,
  updateAccount,
};
