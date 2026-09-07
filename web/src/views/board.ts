import { api, type Board, type PinItem, type SyncJob } from "../api.js";

interface Options {
  board: Board;
  onBack: () => void;
}

const CHECK_SVG = `<svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5L6.5 12L13 4.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export async function renderBoard(container: HTMLElement, options: Options) {
  const { board } = options;
  const selected = new Set<string>();
  let job: SyncJob | null = null;

  container.innerHTML = `
    <div class="shell">
      <header class="board-header">
        <div class="board-header-title">
          <button class="link-btn" id="back">← Vos tableaux</button>
          <h2>${escapeHtml(board.name)}</h2>
          <span class="count" id="count"></span>
        </div>
        <div class="board-actions" id="actions" style="display:none">
          <span class="selection-count" id="selection-count">0 sélectionnée(s)</span>
          <button class="btn" id="select-all">Tout sélectionner</button>
          <button class="btn" id="select-none">Tout désélectionner</button>
          <button class="btn btn-accent" id="download" disabled>Télécharger le ZIP</button>
        </div>
      </header>
      <div id="body"></div>
    </div>
  `;

  container.querySelector("#back")?.addEventListener("click", options.onBack);

  const body = container.querySelector("#body") as HTMLElement;
  const countEl = container.querySelector("#count") as HTMLElement;
  const actions = container.querySelector("#actions") as HTMLElement;
  const selectionCountEl = container.querySelector("#selection-count") as HTMLElement;
  const downloadBtn = container.querySelector("#download") as HTMLButtonElement;

  body.innerHTML = `
    <div class="progress-wrap">
      <span class="progress-label" id="progress-label">Récupération des épingles…</span>
      <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
    </div>
  `;

  let jobId: string;
  try {
    const start = await api.startSync(board.id, board.name);
    jobId = start.jobId;
  } catch (err) {
    body.innerHTML = `<p class="empty-state">Impossible de démarrer la récupération : ${escapeHtml(
      err instanceof Error ? err.message : "erreur inconnue"
    )}</p>`;
    return;
  }

  const progressLabel = container.querySelector("#progress-label") as HTMLElement;
  const progressFill = container.querySelector("#progress-fill") as HTMLElement;

  await pollUntilDone();

  async function pollUntilDone() {
    for (;;) {
      job = await api.getJob(jobId);

      if (job.status === "running") {
        progressLabel.textContent = `Récupération des épingles… (${job.fetched} trouvées)`;
        const estimated = Math.max(board.pinCount, job.fetched, 1);
        progressFill.style.width = `${Math.min(95, (job.fetched / estimated) * 100)}%`;
        await new Promise((r) => setTimeout(r, 900));
        continue;
      }

      if (job.status === "error") {
        body.innerHTML = `<p class="empty-state">Erreur pendant la récupération : ${escapeHtml(
          job.error ?? "erreur inconnue"
        )}</p>`;
        return;
      }

      progressFill.style.width = "100%";
      renderGrid(job.items);
      return;
    }
  }

  function renderGrid(items: PinItem[]) {
    countEl.textContent = `${items.length} image${items.length > 1 ? "s" : ""}${
      job && job.duplicatesSkipped > 0 ? ` · ${job.duplicatesSkipped} doublon(s) ignoré(s)` : ""
    }`;

    if (items.length === 0) {
      body.innerHTML = `<p class="empty-state">Ce tableau ne contient aucune image exploitable.</p>`;
      return;
    }

    actions.style.display = "flex";

    body.innerHTML = `<div class="masonry" id="masonry"></div><div id="zip-report"></div>`;
    const masonry = body.querySelector("#masonry") as HTMLElement;

    masonry.innerHTML = items
      .map(
        (item) => `
      <figure class="pin" data-id="${item.pinId}">
        <a href="${item.pinUrl}" target="_blank" rel="noopener">
          <img src="${item.imageUrl}" loading="lazy" width="${item.width}" height="${item.height}" alt="" />
        </a>
        <button class="pin-check" data-id="${item.pinId}" aria-label="Sélectionner">${CHECK_SVG}</button>
      </figure>
    `
      )
      .join("");

    masonry.querySelectorAll<HTMLButtonElement>(".pin-check").forEach((btn) => {
      btn.addEventListener("click", () => toggle(btn.dataset.id!));
    });

    container.querySelector("#select-all")?.addEventListener("click", () => {
      items.forEach((i) => selected.add(i.pinId));
      syncSelectionUi();
    });
    container.querySelector("#select-none")?.addEventListener("click", () => {
      selected.clear();
      syncSelectionUi();
    });

    downloadBtn.addEventListener("click", () => generateZip(items));

    function toggle(pinId: string) {
      if (selected.has(pinId)) selected.delete(pinId);
      else selected.add(pinId);
      syncSelectionUi();
    }

    function syncSelectionUi() {
      masonry.querySelectorAll<HTMLElement>(".pin").forEach((el) => {
        el.classList.toggle("selected", selected.has(el.dataset.id!));
      });
      selectionCountEl.textContent = `${selected.size} sélectionnée(s)`;
      downloadBtn.disabled = selected.size === 0;
    }
  }

  async function generateZip(items: PinItem[]) {
    const pinIds = [...selected];
    const reportEl = body.querySelector("#zip-report") as HTMLElement;
    downloadBtn.disabled = true;
    const originalLabel = downloadBtn.textContent;
    downloadBtn.textContent = "Génération du ZIP…";
    reportEl.innerHTML = "";

    try {
      const res = await fetch(api.zipUrl(jobId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinIds }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Erreur ${res.status}`);
      }

      const failedRaw = decodeURIComponent(res.headers.get("X-Failed-Pin-Ids") ?? "");
      const failedIds = failedRaw ? failedRaw.split(",") : [];

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${board.name.replace(/[^a-z0-9-_]+/gi, "_") || "tableau"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (failedIds.length > 0) {
        const failedItems = items.filter((i) => failedIds.includes(i.pinId));
        reportEl.innerHTML = `
          <div class="zip-report">
            <h3>${failedItems.length} image${failedItems.length > 1 ? "s" : ""} indisponible${
          failedItems.length > 1 ? "s" : ""
        }</h3>
            <p>Le ZIP a bien été généré avec les autres images. Ces épingles n'ont pas pu être téléchargées :</p>
            <ul class="failed-list">
              ${failedItems
                .map(
                  (i) => `<li><span>${escapeHtml(i.section)}</span><a href="${i.pinUrl}" target="_blank" rel="noopener">Voir le pin →</a></li>`
                )
                .join("")}
            </ul>
          </div>
        `;
      } else {
        reportEl.innerHTML = `<div class="zip-report"><p>ZIP généré avec succès, aucune image manquante.</p></div>`;
      }
    } catch (err) {
      reportEl.innerHTML = `<div class="zip-report"><p>Échec de la génération du ZIP : ${escapeHtml(
        err instanceof Error ? err.message : "erreur inconnue"
      )}</p></div>`;
    } finally {
      downloadBtn.disabled = selected.size === 0;
      downloadBtn.textContent = originalLabel;
    }
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
