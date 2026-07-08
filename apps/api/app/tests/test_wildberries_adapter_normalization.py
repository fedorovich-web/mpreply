from app.adapters.wildberries import WildberriesAdapter


def test_wildberries_extracts_feedbacks_from_nested_payload():
    adapter = WildberriesAdapter()
    payload = {"data": {"feedbacks": [{"id": "fb-1", "text": "ok"}]}}

    assert adapter.extract_reviews(payload) == [{"id": "fb-1", "text": "ok"}]


def test_wildberries_normalizes_feedback_without_customer_name():
    adapter = WildberriesAdapter()
    normalized = adapter.normalize_review(
        {
            "id": "fb-1",
            "text": "Хороший товар",
            "productValuation": 5,
            "createdDate": "2026-07-08T10:00:00Z",
            "productDetails": {"nmId": 123, "productName": "Кроссовки", "brandName": "Brand"},
        }
    )

    assert normalized["external_id"] == "fb-1"
    assert normalized["type"] == "review"
    assert normalized["rating"] == 5
    assert normalized["customer_text"] == "Хороший товар"
    assert normalized["product"]["external_id"] == "123"
    assert normalized["product"]["name"] == "Кроссовки"


def test_wildberries_normalizes_question():
    adapter = WildberriesAdapter()
    normalized = adapter.normalize_question(
        {
            "id": "q-1",
            "question": "Подойдёт на рост 170?",
            "createdDate": "2026-07-08T10:00:00Z",
            "nmId": 777,
            "productName": "Куртка",
        }
    )

    assert normalized["external_id"] == "q-1"
    assert normalized["type"] == "question"
    assert normalized["rating"] is None
    assert normalized["customer_text"] == "Подойдёт на рост 170?"
    assert normalized["product"]["external_id"] == "777"
