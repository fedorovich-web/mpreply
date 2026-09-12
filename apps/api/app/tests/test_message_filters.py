from inspect import signature
from uuid import uuid4

from app.api.messages import list_messages
from app.services.message_service import MessageService


def test_message_list_route_exposes_assignee_filter() -> None:
    assert "assigned_to" in signature(list_messages).parameters


def test_message_filter_conditions_include_assignee() -> None:
    assigned_to = uuid4()

    conditions = MessageService._build_filter_conditions(
        marketplace=None,
        message_type=None,
        status=None,
        rating_min=None,
        rating_max=None,
        product_id=None,
        assigned_to=assigned_to,
        search=None,
    )

    assert len(conditions) == 1
    condition = conditions[0]
    assert getattr(condition.left, "key", None) == "assigned_to"
    assert getattr(condition.right, "value", None) == assigned_to
