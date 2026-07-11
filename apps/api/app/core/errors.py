from fastapi import HTTPException, status


def bad_request(message: str = "Bad request") -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)


def unauthorized(message: str = "Unauthorized") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def forbidden(message: str = "Forbidden") -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=message)


def not_found(message: str = "Not found") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=message)


def conflict(message: str = "Conflict") -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message)


def payment_required(message: str = "Payment required") -> HTTPException:
    return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=message)
