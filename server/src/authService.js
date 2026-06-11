const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { getSupabase } = require("./supabase");
const { now, throwIfError, normalizeAccount } = require("./dbUtils");

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
    if (key === "able_driver") {
      row[key] = Boolean(account.able_driver);
      continue;
    }
    row[key] = account[key];
  }
  return row;
}

async function getAccountById(id) {
  const data = throwIfError(
    await getSupabase().from("accounts").select("*").eq("id", id).maybeSingle()
  );
  return pickPublic(normalizeAccount(data));
}

async function getAccountByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const data = throwIfError(
    await getSupabase()
      .from("accounts")
      .select("*")
      .eq("email", normalized)
      .maybeSingle()
  );
  return data ? normalizeAccount(data) : null;
}

async function createAccount({ fname, lname, email, phone, gender, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const timestamp = now();
  const id = randomUUID();

  const result = await getSupabase()
    .from("accounts")
    .insert({
      id,
      fname,
      lname,
      email: normalizedEmail,
      phone: phone ?? null,
      gender,
      able_driver: true,
      password_hash: passwordHash,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select("*")
    .single();

  if (result.error) {
    if (result.error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw new Error(result.error.message);
  }

  return pickPublic(normalizeAccount(result.data));
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
  const normalizedEmail = data.email.trim().toLowerCase();
  const conflict = throwIfError(
    await getSupabase()
      .from("accounts")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("id", id)
      .maybeSingle()
  );
  if (conflict) {
    throw new Error("An account with that email already exists.");
  }

  const existing = throwIfError(
    await getSupabase().from("accounts").select("*").eq("id", id).maybeSingle()
  );
  if (!existing) {
    throw new Error("Account not found.");
  }

  const normalized = normalizeAccount(existing);
  const payload = {
    fname: data.fname,
    lname: data.lname,
    email: normalizedEmail,
    phone: data.phone ?? null,
    gender: data.gender,
    able_driver:
      data.able_driver !== undefined ? Boolean(data.able_driver) : Boolean(normalized.able_driver),
    updated_at: now(),
  };

  const row = throwIfError(
    await getSupabase()
      .from("accounts")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single()
  );
  return pickPublic(normalizeAccount(row));
}

module.exports = {
  pickPublic,
  getAccountById,
  getAccountByEmail,
  createAccount,
  verifyLogin,
  updateAccount,
};
