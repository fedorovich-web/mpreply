import { YandexIdentityPanel } from "../../../../components/auth/YandexIdentityPanel";

export default function AccountPage() {
  return <section className="app-page app-page-wide"><header className="app-header"><h1>Account</h1><p>Manage how you sign in to MPReply.</p></header><YandexIdentityPanel /></section>;
}
