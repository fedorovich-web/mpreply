import Image from "next/image";

const models = [
  {
    name: "GPT-6 Luna", provider: "OpenAI", icon: "/images/brands/chatgpt-sign-logo.svg",
    ru: "Быстрая модель для коротких ответов, классификации обращений и повседневных задач.",
    en: "A fast model for concise replies, message classification and everyday tasks.",
  },
  {
    name: "Claude Sonnet 5.5", provider: "Anthropic", icon: "/images/brands/claude-icon-logo.svg",
    ru: "Работает с длинным контекстом и помогает выстроить ясный, последовательный текст.",
    en: "Works with long context and helps shape clear, consistent text.",
  },
  {
    name: "Gemini 3.8", provider: "Google", icon: "/images/brands/gemini.svg",
    ru: "Мультимодальная модель для работы с текстом, изображениями и подробным контекстом.",
    en: "A multimodal model for text, images and detailed context.",
  },
  {
    name: "DeepSeek V4.1", provider: "DeepSeek", icon: "/images/brands/deepseek-sign-logo.svg",
    ru: "Быстрая обработка текста и рассуждения для повторяющихся задач с большим потоком обращений.",
    en: "Fast text processing and reasoning for recurring tasks with a high volume of messages.",
  },
] as const;

export function HomeModelsSection({ locale = "ru" }: { locale?: "ru" | "en" }) {
  const ru = locale === "ru";
  return (
    <section className="public-section homepage-models-section home-reference-models">
      <div className="public-container homepage-models-layout">
        <div className="homepage-section-heading-left">
          <h2>{ru ? "Четыре нейросети для точных и естественных ответов" : "Four AI models for clear, natural replies"}</h2>
          <p>{ru ? "От короткого ответа на отзыв до работы с подробным контекстом: у каждой модели свои сильные стороны." : "From a short review reply to detailed context: each model has its own strengths."}</p>
        </div>
        <div className="homepage-model-grid" role="group" aria-label={ru ? "Четыре нейросети" : "Four AI models"}>
          {models.map((model) => (
            <div className="homepage-model-card" key={model.name}>
              <span className="homepage-model-mark" aria-hidden="true"><Image src={model.icon} alt="" width={44} height={44} unoptimized /></span>
              <small>{model.provider}</small>
              <strong>{model.name}</strong>
              <p className="homepage-model-description">{model[locale]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
