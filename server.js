const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database("./db.sqlite");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_url TEXT NOT NULL,
      short_code TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      click_count INTEGER DEFAULT 0
    )
  `);
});

function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let trimmed = rawUrl.trim();

  if (!trimmed) return null;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = "https://" + trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!url.hostname) return null;
    return trimmed;
  } catch (err) {
    return null;
  }
}

function generateShortCode() {
  return crypto.randomBytes(4).toString("hex");
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Server is running" });
});

app.get("/api/links", (req, res) => {
  db.all(
    "SELECT id, original_url, short_code, created_at, click_count FROM links ORDER BY id DESC LIMIT 10",
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to fetch links" });
      }

      res.json(rows);
    }
  );
});

app.post("/api/shorten", (req, res) => {
  const rawUrl = req.body && req.body.url;

  const validUrl = validateUrl(rawUrl);
  if (!validUrl) {
    return res.status(400).json({ error: "Please enter a valid URL" });
  }

  let shortCode = generateShortCode();

  const saveLink = () => {
    db.run(
      "INSERT INTO links (original_url, short_code) VALUES (?, ?)",
      [validUrl, shortCode],
      function (err) {
        if (err) {
          if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
            shortCode = generateShortCode();
            return saveLink();
          }

          console.error(err);
          return res.status(500).json({ error: "Could not create short URL" });
        }

        const fullShortUrl = `${getBaseUrl(req)}/${shortCode}`;
        return res.json({
          shortUrl: fullShortUrl,
          shortCode
        });
      }
    );
  };

  saveLink();
});

app.get("/:code", (req, res) => {
  const { code } = req.params;

  if (!code || code.length < 4) {
    return res.status(404).send("Link not found");
  }

  db.get(
    "SELECT original_url FROM links WHERE short_code = ?",
    [code],
    (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Server error");
      }

      if (!row) {
        return res.status(404).send("Link not found");
      }

      db.run(
        "UPDATE links SET click_count = click_count + 1 WHERE short_code = ?",
        [code]
      );

      res.redirect(row.original_url);
    }
  );
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
