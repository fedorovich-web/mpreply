import { KnowledgeBaseWorkspace } from "../../../components/knowledge/KnowledgeBaseWorkspace";

export default function KnowledgeBasePage() {
  return <section className="app-page app-page-wide"><header className="app-header"><p className="eyebrow">Автоматизация</p><h1>База знаний</h1><p>Храните проверенные сведения, на которые система может опираться при подготовке ответов.</p></header><KnowledgeBaseWorkspace /></section>;
}
