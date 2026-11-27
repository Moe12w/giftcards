<?php

namespace Tazella\GiftCards;

final class TazellaException extends \RuntimeException
{
    /** @var string Gateway error code, e.g. INSUFFICIENT_BALANCE. */
    private string $errorCode;

    private bool $retryable;

    /** @var string|null Gateway request id, safe to show in support threads. */
    private ?string $requestId;

    private ?int $httpStatus;

    private const PUBLIC_MESSAGES = [
        'INVALID_REQUEST' => 'Check the card details and try again.',
        'UNAUTHORIZED' => 'Payment is temporarily unavailable. Please try again.',
        'FORBIDDEN_SCOPE' => 'This payment method is not available for this order.',
        'PLATFORM_NOT_ACTIVE' => 'This payment method is temporarily unavailable.',
        'MAPPING_NOT_FOUND' => 'This business is not set up for gift-card payments here.',
        'MAPPING_NOT_ACTIVE' => 'This business is not currently accepting gift cards here.',
        'CARD_NOT_FOUND' => 'This gift card cannot be used here.',
        'CARD_INACTIVE' => 'This gift card is not available for payment.',
        'CARD_EXPIRED' => 'This gift card has expired.',
        'CARD_WRONG_BUSINESS' => 'This gift card cannot be used here.',
        'CURRENCY_MISMATCH' => 'The gift card currency does not match this order.',
        'INSUFFICIENT_BALANCE' => 'This gift card does not have enough available balance.',
        'RESERVATION_NOT_FOUND' => 'This gift-card payment is no longer available.',
        'RESERVATION_EXPIRED' => 'The gift-card hold expired. Please apply the card again.',
        'RESERVATION_ALREADY_CAPTURED' => 'This gift-card payment was already completed.',
        'RESERVATION_NOT_CAPTURABLE' => 'This gift-card payment can no longer be changed.',
        'AMOUNT_EXCEEDS_RESERVATION' => 'The amount is higher than the applied gift-card amount.',
        'IDEMPOTENCY_CONFLICT' => 'The payment is being processed. Please wait and try again.',
        'IDEMPOTENCY_IN_PROGRESS' => 'The payment is being processed. Please wait and try again.',
        'RATE_LIMITED' => 'Too many attempts. Please wait a moment.',
        'RECONCILIATION_REQUIRED' => 'This payment needs manual review. No money was moved.',
        'REDEMPTION_NOT_FOUND' => 'This gift-card payment was not found.',
        'PLATFORM_UNAVAILABLE' => 'Payment is temporarily unavailable. Please try again.',
        'INTERNAL_ERROR' => 'Payment is temporarily unavailable. Please try again.',
    ];

    public function __construct(
        string $errorCode,
        string $message,
        bool $retryable = false,
        ?string $requestId = null,
        ?int $httpStatus = null
    ) {
        parent::__construct($message);
        $this->errorCode = $errorCode;
        $this->retryable = $retryable;
        $this->requestId = $requestId;
        $this->httpStatus = $httpStatus;
    }

    public static function publicMessage(string $code, string $fallback = ''): string
    {
        return self::PUBLIC_MESSAGES[$code] ?? ($fallback !== '' ? $fallback : self::PUBLIC_MESSAGES['INTERNAL_ERROR']);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function isRetryable(): bool
    {
        return $this->retryable;
    }

    public function requestId(): ?string
    {
        return $this->requestId;
    }

    public function httpStatus(): ?int
    {
        return $this->httpStatus;
    }
}
