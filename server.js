const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- helper ----------
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

// ================= BOOKS =================
app.get("/api/books", (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR genre LIKE ? ORDER BY id DESC"
      )
      .all(like, like, like);
  } else {
    rows = db.prepare("SELECT * FROM books ORDER BY id DESC").all();
  }
  res.json(rows);
});

app.post("/api/books", (req, res) => {
  const { title, author, genre, total_copies } = req.body;
  if (!title || !author) return res.status(400).json({ error: "title and author are required" });
  const copies = Number(total_copies) || 1;
  const stmt = db.prepare(
    "INSERT INTO books (title, author, genre, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)"
  );
  const info = stmt.run(title, author, genre || "", copies, copies);
  res.status(201).json(db.prepare("SELECT * FROM books WHERE id = ?").get(info.lastInsertRowid));
});

app.put("/api/books/:id", (req, res) => {
  const { title, author, genre, total_copies } = req.body;
  const existing = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "book not found" });

  const newTotal = total_copies !== undefined ? Number(total_copies) : existing.total_copies;
  const diff = newTotal - existing.total_copies;
  const newAvailable = Math.max(0, existing.available_copies + diff);

  db.prepare(
    "UPDATE books SET title=?, author=?, genre=?, total_copies=?, available_copies=? WHERE id=?"
  ).run(
    title ?? existing.title,
    author ?? existing.author,
    genre ?? existing.genre,
    newTotal,
    newAvailable,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id));
});

app.delete("/api/books/:id", (req, res) => {
  db.prepare("DELETE FROM books WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ================= MEMBERS =================
app.get("/api/members", (req, res) => {
  res.json(db.prepare("SELECT * FROM members ORDER BY id DESC").all());
});

app.post("/api/members", (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });
  try {
    const info = db
      .prepare("INSERT INTO members (name, email, phone) VALUES (?, ?, ?)")
      .run(name, email, phone || "");
    res.status(201).json(db.prepare("SELECT * FROM members WHERE id = ?").get(info.lastInsertRowid));
  } catch (e) {
    res.status(400).json({ error: "email already exists" });
  }
});

app.put("/api/members/:id", (req, res) => {
  const { name, email, phone } = req.body;
  const existing = db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "member not found" });
  db.prepare("UPDATE members SET name=?, email=?, phone=? WHERE id=?").run(
    name ?? existing.name,
    email ?? existing.email,
    phone ?? existing.phone,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM members WHERE id = ?").get(req.params.id));
});

app.delete("/api/members/:id", (req, res) => {
  db.prepare("DELETE FROM members WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// ================= TRANSACTIONS =================
app.get("/api/transactions", (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, b.title AS book_title, m.name AS member_name
       FROM transactions t
       JOIN books b ON b.id = t.book_id
       JOIN members m ON m.id = t.member_id
       ORDER BY t.id DESC`
    )
    .all();
  res.json(rows);
});

app.get("/api/transactions/overdue", (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, b.title AS book_title, m.name AS member_name
       FROM transactions t
       JOIN books b ON b.id = t.book_id
       JOIN members m ON m.id = t.member_id
       WHERE t.status = 'issued' AND t.due_date < ?
       ORDER BY t.due_date ASC`
    )
    .all(today());
  res.json(rows);
});

app.post("/api/transactions/issue", (req, res) => {
  const { book_id, member_id, days } = req.body;
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(book_id);
  const member = db.prepare("SELECT * FROM members WHERE id = ?").get(member_id);
  if (!book || !member) return res.status(404).json({ error: "book or member not found" });
  if (book.available_copies < 1) return res.status(400).json({ error: "no copies available" });

  const issue_date = today();
  const due_date = addDays(issue_date, days || 14);

  const info = db
    .prepare(
      "INSERT INTO transactions (book_id, member_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, 'issued')"
    )
    .run(book_id, member_id, issue_date, due_date);

  db.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?").run(book_id);

  res.status(201).json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(info.lastInsertRowid));
});

app.post("/api/transactions/:id/return", (req, res) => {
  const txn = db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id);
  if (!txn) return res.status(404).json({ error: "transaction not found" });
  if (txn.status === "returned") return res.status(400).json({ error: "already returned" });

  db.prepare("UPDATE transactions SET status='returned', return_date=? WHERE id=?").run(
    today(),
    req.params.id
  );
  db.prepare("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?").run(txn.book_id);

  res.json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(req.params.id));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Library API running on http://localhost:${PORT}`));