const form = document.getElementById("shortener-form");
const urlInput = document.getElementById("url-input");
const resultBox = document.getElementById("result");
const shortLink = document.getElementById("short-link");
const copyBtn = document.getElementById("copy-btn");
const linksList = document.getElementById("links-list");

async function fetchRecentLinks() {
  try {
    const response = await fetch("/api/links");
    const links = await response.json();

    if (!Array.isArray(links)) return;

    linksList.innerHTML = "";

    if (links.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No links created yet. Try shortening one above.";
      empty.style.color = "#a8b3cf";
      linksList.appendChild(empty);
      return;
    }

    links.forEach((link) => {
      const item = document.createElement("li");

      const meta = document.createElement("div");
      meta.className = "link-meta";

      const code = document.createElement("span");
      code.className = "link-code";
      code.textContent = `/${link.short_code}`;

      const target = document.createElement("span");
      target.className = "link-target";
      target.title = link.original_url;
      target.textContent = link.original_url;

      meta.appendChild(code);
      meta.appendChild(target);

      const count = document.createElement("span");
      count.className = "click-count";
      count.textContent = `${link.click_count} clicks`;

      item.appendChild(meta);
      item.appendChild(count);

      linksList.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to fetch recent links:", error);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  if (!url) {
    alert("Please enter a URL");
    return;
  }

  try {
    const response = await fetch("/api/shorten", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    shortLink.href = data.shortUrl;
    shortLink.textContent = data.shortUrl;
    resultBox.classList.remove("hidden");

    urlInput.value = "";
    await fetchRecentLinks();
  } catch (error) {
    alert(error.message);
  }
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shortLink.textContent);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy";
    }, 1200);
  } catch (error) {
    console.error("Copy failed:", error);
    alert("Copy not supported in this browser.");
  }
});

fetchRecentLinks();
