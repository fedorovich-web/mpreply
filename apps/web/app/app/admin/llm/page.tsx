import { AdminLLMWorkspace } from "../../../../components/admin/AdminLLMWorkspace";

export default function AdminLLMPage() {
  return (
    <section className="app-page">
      <section className="app-header">
        <p className="eyebrow">Системная конфигурация</p>
        <h1>Модели AI</h1>
        <p>Единый ключ OpenRouter и маршруты моделей для шести сценариев генерации MPReply.</p>
      </section>
      <AdminLLMWorkspace />
    </section>
  );
}
