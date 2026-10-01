import { YandexIdentityPanel } from "../../../components/auth/YandexIdentityPanel";

export default function AccountPage() {
  return <section className="app-page app-page-wide"><header className="app-header"><h1>Аккаунт</h1><p>Настройте способ входа в MPReply.</p></header><YandexIdentityPanel /></section>;
}
