export function renderHome(container: HTMLElement) {
  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");

  container.innerHTML = `
    <div class="shell">
      <header class="masthead">
        <h1 class="wordmark">Pinterest<br />Download</h1>
      </header>
      <main class="hero">
        <p class="pitch">
          Récupérez toutes les images d'un tableau Pinterest dans un fichier ZIP,
          en meilleure résolution, prêtes pour vos moodboards Figma, Illustrator
          ou InDesign.
        </p>
        ${authError ? `<p class="auth-error">Connexion refusée : ${escapeHtml(authError)}</p>` : ""}
        <a class="btn btn-accent" href="/auth/pinterest">Connecter mon compte Pinterest</a>
      </main>
      <footer class="foot">
        <p>Aucune image n'est stockée sur le serveur : tout est généré à la demande. V1 — sans compte payant.</p>
      </footer>
    </div>
  `;

  if (authError) {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", url.toString());
  }
}

function escapeHtml(value: string): string {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
