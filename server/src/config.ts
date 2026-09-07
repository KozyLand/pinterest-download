import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}. Copie server/.env.example vers server/.env et remplis-le.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-secret-not-for-production",
  pinterest: {
    get appId() {
      return required("PINTEREST_APP_ID");
    },
    get appSecret() {
      return required("PINTEREST_APP_SECRET");
    },
    get redirectUri() {
      return required("PINTEREST_REDIRECT_URI");
    },
  },
};
