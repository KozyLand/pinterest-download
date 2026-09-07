import { api, type Board } from "../api.js";

interface Options {
  username?: string;
  onOpenBoard: (board: Board) => void;
  onLogout: () => void;
}

export async function renderBoards(container: HTMLElement, options: Options) {
  container.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <h1 class="wordmark-sm">Pinterest Download</h1>
        <div class="account">
          ${options.username ? `<span>Connecté en tant que @${options.username}</span>` : ""}
          <button class="link-btn" id="logout">Se déconnecter</button>
        </div>
      </header>
      <main>
        <h2 class="section-title">Vos tableaux</h2>
        <div id="board-slot"><p class="empty-state">Chargement des tableaux…</p></div>
      </main>
    </div>
  `;

  container.querySelector("#logout")?.addEventListener("click", async () => {
    await api.logout();
    options.onLogout();
  });

  const slot = container.querySelector("#board-slot") as HTMLElement;

  try {
    const { boards } = await api.listBoards();

    if (boards.length === 0) {
      slot.innerHTML = `<p class="empty-state">Aucun tableau trouvé sur ce compte Pinterest.</p>`;
      return;
    }

    slot.innerHTML = `
      <div class="board-grid">
        ${boards
          .map(
            (b) => `
          <button class="board-card" data-id="${b.id}">
            <span class="board-cover" style="${b.coverUrl ? `background-image:url('${b.coverUrl}')` : ""}"></span>
            <span class="board-name">${escapeHtml(b.name)}</span>
            <span class="board-count">${b.pinCount} épingle${b.pinCount > 1 ? "s" : ""}</span>
          </button>
        `
          )
          .join("")}
      </div>
    `;

    slot.querySelectorAll<HTMLButtonElement>(".board-card").forEach((el, index) => {
      el.addEventListener("click", () => options.onOpenBoard(boards[index]));
    });
  } catch (err) {
    slot.innerHTML = `<p class="empty-state">Impossible de charger les tableaux : ${escapeHtml(
      err instanceof Error ? err.message : "erreur inconnue"
    )}</p>`;
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
