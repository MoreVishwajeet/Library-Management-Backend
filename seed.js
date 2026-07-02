const db = require("./db");

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

// wipe existing data so this script is safe to re-run
db.exec("DELETE FROM transactions");
db.exec("DELETE FROM books");
db.exec("DELETE FROM members");
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('books','members','transactions')");

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

const insertBook = db.prepare(
  "INSERT INTO books (title, author, genre, total_copies, available_copies) VALUES (?, ?, ?, ?, ?)"
);
const bookIds = books.map((b) => insertBook.run(b.title, b.author, b.genre, b.total_copies, b.total_copies).lastInsertRowid);

const insertMember = db.prepare("INSERT INTO members (name, email, phone) VALUES (?, ?, ?)");
const memberIds = members.map((m) => insertMember.run(m.name, m.email, m.phone).lastInsertRowid);

const insertTxn = db.prepare(
  "INSERT INTO transactions (book_id, member_id, issue_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?)"
);
const updateAvailable = db.prepare("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?");

// a currently issued, on-time loan
insertTxn.run(bookIds[0], memberIds[0], addDays(today(), -3), addDays(today(), 11), null, "issued");
updateAvailable.run(bookIds[0]);

// an overdue loan (due date already passed)
insertTxn.run(bookIds[1], memberIds[1], addDays(today(), -20), addDays(today(), -6), null, "issued");
updateAvailable.run(bookIds[1]);

// another overdue loan
insertTxn.run(bookIds[4], memberIds[2], addDays(today(), -25), addDays(today(), -11), null, "issued");
updateAvailable.run(bookIds[4]);

// a returned loan (history) — available_copies unaffected since it's back on the shelf
insertTxn.run(bookIds[3], memberIds[3], addDays(today(), -30), addDays(today(), -16), addDays(today(), -18), "returned");

// another returned loan
insertTxn.run(bookIds[6], memberIds[4], addDays(today(), -15), addDays(today(), -1), addDays(today(), -3), "returned");

console.log(`Seeded ${books.length} books, ${members.length} members, 5 transactions (2 overdue).`);