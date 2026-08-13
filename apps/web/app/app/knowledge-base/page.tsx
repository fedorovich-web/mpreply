import { KnowledgeBaseWorkspace } from "../../../components/knowledge/KnowledgeBaseWorkspace";

export default function KnowledgeBasePage() {
  return <section className="app-page app-page-wide"><header className="app-header"><h1>Данные для ответов</h1><p>Добавьте проверенные сведения о компании и товарах, которые MP Reply может использовать в ответах.</p></header><KnowledgeBaseWorkspace /></section>;
}
