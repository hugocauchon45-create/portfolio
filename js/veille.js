const veilleContent = document.querySelector("[data-veille-content]");
const veilleUpdated = document.querySelector("[data-veille-updated]");
const weekPicker = document.querySelector("[data-watch-week]");
const severityPicker = document.querySelector("[data-watch-severity]");
const searchField = document.querySelector("[data-watch-search]");
const resultMessage = document.querySelector("[data-watch-result]");
const categoryButtons = document.querySelectorAll("[data-watch-category]");
let archivedWeeks = [];
let selectedWeek = "latest";
let selectedCategory = "Tous";

const getIsoWeek = (date) => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const cloudCategory = (category) => category === "Cloudflare" ? "Cloud & infrastructure" : category;

const weekPeriod = (value) => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const id = getIsoWeek(date);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const from = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { id, from, to: date.toISOString().slice(0, 10) };
};

const weekRange = (period) => {
  const from = new Date(`${period.from}T12:00:00Z`);
  const to = new Date(`${period.to}T12:00:00Z`);
  const sameMonth = from.getUTCMonth() === to.getUTCMonth() && from.getUTCFullYear() === to.getUTCFullYear();
  const first = new Intl.DateTimeFormat("fr-FR", { day: "numeric", ...(sameMonth ? {} : { month: "long" }), timeZone: "UTC" }).format(from);
  const last = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(to);
  return `du ${first} au ${last}`;
};

// Les anciennes collectes étaient classées par date de collecte : afficher les vraies semaines des annonces.
const buildArchive = (weeks) => {
  const groups = new Map();
  const seen = new Set();
  const addWeek = (period) => {
    if (!groups.has(period.id)) {
      const original = weeks.find((week) => week.id === period.id);
      groups.set(period.id, { id: period.id, period, title: `Semaine ${weekRange(period)}`, conclusion: original?.conclusion || "", items: [] });
    }
    return groups.get(period.id);
  };
  for (const week of weeks) {
    if (!(week.items || []).length) {
      const period = weekPeriod(week.period?.from);
      if (period) addWeek(period);
    }
    for (const item of week.items || []) {
      const period = weekPeriod(item.date) || weekPeriod(week.period?.from);
      const key = item.id || `${item.date}|${item.source?.url}|${item.title}`;
      if (!period || seen.has(key)) continue;
      seen.add(key);
      addWeek(period).items.push(item);
    }
  }
  return [...groups.values()].sort((a, b) => b.period.from.localeCompare(a.period.from));
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const safeUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "#";
  } catch {
    return "#";
  }
};

const formatDate = (value) => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? "Date non précisée"
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(date);
};

const renderSecurity = (security) => {
  if (!security) return "";

  const fields = [
    ["Référence", security.identifier],
    ["Gravité", security.severity],
    ["Score", security.cvss],
    ["Éléments concernés", security.affected],
    ["Correctif", security.fix],
  ].filter(([, value]) => value);

  return `<dl class="watch-security">${fields
    .map(
      ([label, value]) =>
        `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("")}</dl>`;
};

const renderItem = (item) => {
  const sourceUrl = safeUrl(item.source?.url);
  const sourceLabel = item.source?.publisher || "Source";
  const categoryLabel = item.category === "Sécurité applicative" ? "Cybersécurité" : cloudCategory(item.category);
  const categoryClass = String(item.category || "autre")
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `<article class="watch-card">
    <p class="watch-meta"><span class="watch-tag watch-tag--${escapeHtml(categoryClass)}">${escapeHtml(categoryLabel)}</span>${item.security?.severity ? `<span class="watch-severity watch-severity--${escapeHtml(item.security.level || "unknown")}">${escapeHtml(item.security.severity)}</span>` : ""}<time datetime="${escapeHtml(item.date)}">${formatDate(item.date)}</time></p>
    <h3><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
    <p>${escapeHtml(item.summary)}</p>
    ${item.impact ? `<p class="watch-impact"><strong>Pourquoi c’est intéressant :</strong> ${escapeHtml(item.impact)}</p>` : ""}
    ${item.detail || item.security || item.portfolioIdea ? `<details class="watch-details"><summary>Lire les détails</summary>
      ${item.detail ? `<p class="watch-detail-text">${escapeHtml(item.detail)}</p>` : ""}
      ${renderSecurity(item.security)}
      ${item.portfolioIdea ? `<p><strong>Piste à explorer :</strong> ${escapeHtml(item.portfolioIdea)}</p>` : ""}
    </details>` : ""}
    <p class="watch-source">Source : <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceLabel)}</a></p>
  </article>`;
};

const renderWeek = (week, items) => `<section class="watch-week" aria-labelledby="${escapeHtml(week.id)}">
  <header class="watch-week__header">
    <div>
      <p class="eyebrow">${escapeHtml(week.id)}</p>
      <h2 id="${escapeHtml(week.id)}">${escapeHtml(week.title)}</h2>
    </div>
    <p>${formatDate(week.period?.from)} — ${formatDate(week.period?.to)}</p>
  </header>
  <div class="watch-grid">${items.map(renderItem).join("")}</div>
  ${week.conclusion ? `<p class="watch-conclusion"><strong>À retenir :</strong> ${escapeHtml(week.conclusion.replace(/^À (?:retenir|présenter) (?:pour|dans) (?:mon |le )?portfolio\s*:\s*/i, ""))}</p>` : ""}
</section>`;

const renderArchive = () => {
  const query = (searchField?.value || "").trim().toLocaleLowerCase("fr-FR");
  const selectedWeekId = selectedWeek === "latest" ? archivedWeeks[0]?.id : selectedWeek;
  const visibleWeeks = archivedWeeks.filter((week) => week.id === selectedWeekId);
  const selectedSeverity = severityPicker?.value || "all";
  let visibleCount = 0;

  const sections = visibleWeeks.map((week) => {
    const items = (week.items || []).filter((item) => {
      const axes = [item.category, ...(item.axes || [])].map(cloudCategory);
      const matchesCategory = selectedCategory === "Tous" || axes.includes(selectedCategory);
      const matchesSeverity = selectedSeverity === "all" || item.security?.level === selectedSeverity;
      const searchText = [item.title, item.category, item.summary, item.detail, item.impact, item.portfolioIdea, item.security?.identifier, item.source?.publisher].join(" ").toLocaleLowerCase("fr-FR");
      return matchesCategory && matchesSeverity && (!query || searchText.includes(query));
    }).sort((a, b) => Number(b.category === "IA") - Number(a.category === "IA") || (b.date || "").localeCompare(a.date || ""));
    if (items.length === 0) return "";
    visibleCount += items.length;
    return renderWeek(week, items);
  }).filter(Boolean);

  veilleContent.innerHTML = sections.length
    ? sections.join("")
    : '<p class="notice">Aucune actualité ne correspond à cette date ou à ces filtres.</p>';
  if (resultMessage) {
    const label = archivedWeeks.find((week) => week.id === selectedWeekId)?.title || "la semaine sélectionnée";
    resultMessage.textContent = `${visibleCount} actualité${visibleCount === 1 ? "" : "s"} affichée${visibleCount === 1 ? "" : "s"} — ${label}.`;
  }
};

const loadVeille = async () => {
  if (!veilleContent) return;

  try {
    const response = await fetch("data/veille.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Le fichier de veille est indisponible.");

    const data = await response.json();
    archivedWeeks = buildArchive(Array.isArray(data.weeks) ? data.weeks : []);
    if (weekPicker) {
      const latest = archivedWeeks[0];
      const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
      const currentPeriod = weekPeriod(today);
      const previousDate = new Date(`${currentPeriod.from}T12:00:00Z`);
      previousDate.setUTCDate(previousDate.getUTCDate() - 7);
      const previousId = getIsoWeek(previousDate);
      weekPicker.innerHTML = archivedWeeks.map((week, index) => {
        const prefix = week.id === currentPeriod.id ? "Semaine en cours" : week.id === previousId ? "Semaine dernière" : index === 0 ? "Dernière semaine publiée" : "Semaine";
        return `<option value="${escapeHtml(week.id)}">${escapeHtml(`${prefix} — ${weekRange(week.period)}`)}</option>`;
      }).join("");
      selectedWeek = latest?.id || "latest";
      weekPicker.value = selectedWeek;
    }
    renderArchive();

    if (veilleUpdated && data.updatedAt) {
      veilleUpdated.textContent = `Mis à jour le ${new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      }).format(new Date(data.updatedAt))}`;
    }
  } catch (error) {
    veilleContent.innerHTML = '<p class="notice">La veille ne peut pas être chargée pour le moment.</p>';
    console.error(error);
  }
};

weekPicker?.addEventListener("change", () => {
  selectedWeek = weekPicker.value;
  renderArchive();
});

searchField?.addEventListener("input", renderArchive);
severityPicker?.addEventListener("change", renderArchive);

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.watchCategory || "Tous";
    categoryButtons.forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
    renderArchive();
  });
});

loadVeille();
