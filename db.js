const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync("library.db");

db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1,
    available_copies INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    return_date TEXT,
    status TEXT NOT NULL DEFAULT 'issued'
  );
`);

module.exports = db;

// ---------- auto-seed on empty DB (handles Render free-tier ephemeral disk resets) ----------
function seedIfEmpty() {
  const { count } = db.prepare("SELECT COUNT(*) AS count FROM books").get();
  if (count > 0) return;

  const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const today = () => new Date().toISOString().slice(0, 10);

  const books = [
    { title: "Clean Code", author: "Robert C. Martin", genre: "Tech", total_copies: 3 },
    { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", genre: "Tech", total_copies: 2 },
    { title: "The Pragmatic Programmer", author: "Andrew Hunt", genre: "Tech", total_copies: 2 },
    { title: "Sapiens", author: "Yuval Noah Harari", genre: "History", total_copies: 2 },
    { title: "Atomic Habits", author: "James Clear", genre: "Self-help", total_copies: 4 },
    { title: "The Silent Patient", author: "Alex Michaelides", genre: "Thriller", total_copies: 2 },
    { title: "Deep Work", author: "Cal Newport", genre: "Self-help", total_copies: 1 },
    { title: "Dune", author: "Frank Herbert", genre: "Sci-Fi", total_copies: 3 },
  ];
  const members = [
    { name: "Vishwa Patil", email: "vishwa@college.edu", phone: "9820011223" },
    { name: "Aditi Rao", email: "aditi.rao@college.edu", phone: "9820011224" },
    { name: "Rohan Mehta", email: "rohan.mehta@college.edu", phone: "9820011225" },
    { name: "Sneha Kulkarni", email: "sneha.k@college.edu", phone: "9820011226" },
    { name: "Karan Shah", email: "karan.shah@college.edu", phone: "9820011227" },
  ];

  const insertBook = db.prepare("INSERT INTO books (title, author, genre, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)");
  const bookIds = books.map((b) => insertBook.run(b.title, b.author, b.genre, b.total_copies, b.total_copies).lastInsertRowid);

  const insertMember = db.prepare("INSERT INTO members (name, email, phone) VALUES (?, ?, ?)");
  const memberIds = members.map((m) => insertMember.run(m.name, m.email, m.phone).lastInsertRowid);

  const insertTxn = db.prepare("INSERT INTO transactions (book_id, member_id, issue_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?)");
  const decrementAvailable = db.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?");

  insertTxn.run(bookIds[0], memberIds[0], addDays(today(), -3), addDays(today(), 11), null, "issued");
  decrementAvailable.run(bookIds[0]);
  insertTxn.run(bookIds[1], memberIds[1], addDays(today(), -20), addDays(today(), -6), null, "issued");
  decrementAvailable.run(bookIds[1]);
  insertTxn.run(bookIds[4], memberIds[2], addDays(today(), -25), addDays(today(), -11), null, "issued");
  decrementAvailable.run(bookIds[4]);
  insertTxn.run(bookIds[3], memberIds[3], addDays(today(), -30), addDays(today(), -16), addDays(today(), -18), "returned");
  insertTxn.run(bookIds[6], memberIds[4], addDays(today(), -15), addDays(today(), -1), addDays(today(), -3), "returned");

  console.log("Auto-seeded demo data (fresh/empty database detected).");
}

seedIfEmpty();