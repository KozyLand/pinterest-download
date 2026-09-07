import { api, type Board } from "./api.js";
import { renderHome } from "./views/home.js";
import { renderBoards } from "./views/boards.js";
import { renderBoard } from "./views/board.js";

const app = document.getElementById("app") as HTMLElement;

async function boot() {
  const status = await api.authStatus().catch(() => ({ connected: false as const }));

  if (!status.connected) {
    renderHome(app);
    return;
  }

  showBoards(status.username);
}

function showBoards(username?: string) {
  renderBoards(app, {
    username,
    onOpenBoard: (board: Board) => showBoard(board, username),
    onLogout: () => {
      window.location.href = "/";
    },
  });
}

function showBoard(board: Board, username?: string) {
  renderBoard(app, {
    board,
    onBack: () => showBoards(username),
  });
}

boot();
