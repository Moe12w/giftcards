<?php
/**
 * Tazella PHP client for the external-platform gift-card gateway.
 *
 * This class holds the platform credential and signs requests. It is meant for
 * server-side use only (WordPress plugin backend, PHP service, etc.). Never
 * expose the API key or signing secret to a browser.
 *
 * Requires PHP 7.4+.
 */

namespace Tazella\GiftCards;

interface HttpClient
{
    /**
     * @return array{status: int, body: string}
     */
    public function request(string $url, string $method, array $headers, string $body): array;
}

final class CurlHttpClient implements HttpClient
{
    public function request(string $url, string $method, array $headers, string $body): array
    {
        if (!function_exists('curl_init')) {
            throw new TazellaException('INTERNAL_ERROR', 'cURL is not available.', false);
        }

        $handle = curl_init($url);
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headerLines,
            CURLOPT_POSTFIELDS => $method === 'GET' ? null : $body,
            CURLOPT_TIMEOUT => 30,
        ]);

        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($raw === false) {
            throw new TazellaException('PLATFORM_UNAVAILABLE', $error ?: 'Request failed.', true);
        }

        return ['status' => $status, 'body' => (string) $raw];
    }
}

final class WordPressHttpClient implements HttpClient
{
    public function request(string $url, string $method, array $headers, string $body): array
    {
        $response = wp_remote_request($url, [
            'method' => $method,
            'headers' => $headers,
            'body' => $method === 'GET' ? null : $body,
            'timeout' => 30,
        ]);

        if (is_wp_error($response)) {
            throw new TazellaException('PLATFORM_UNAVAILABLE', $response->get_error_message(), true);
        }

        return [
            'status' => (int) wp_remote_retrieve_response_code($response),
            'body' => (string) wp_remote_retrieve_body($response),
        ];
    }
}

final class Client
{
    private string $baseUrl;
    private string $platformCode;
    private string $environment;
    private string $apiKey;
    private string $signingSecret;
    private HttpClient $http;

    public function __construct(
        string $baseUrl,
        string $platformCode,
        string $environment,
        string $apiKey,
        string $signingSecret,
        ?HttpClient $http = null
    ) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->platformCode = $platformCode;
        $this->environment = $environment;
        $this->apiKey = $apiKey;
        $this->signingSecret = $signingSecret;
        $this->http = $http ?? (function_exists('wp_remote_request')
            ? new WordPressHttpClient()
            : new CurlHttpClient());
    }

    public static function idempotencyKey(string $scope): string
    {
        return 'php_' . $scope . '_' . bin2hex(random_bytes(12));
    }

    public function health(): array
    {
        return $this->call('GET', '/health', null, null);
    }

    public function validate(array $request): array
    {
        return $this->call('POST', '/gift-cards/validate', $request, null);
    }

    public function preview(array $request): array
    {
        return $this->call('POST', '/gift-cards/preview', $request, null);
    }

    public function reserve(array $request): array
    {
        $key = $this->takeIdempotencyKey($request);
        return $this->call('POST', '/reservations', $request, $key);
    }

    public function capture(string $reference, array $request): array
    {
        $key = $this->takeIdempotencyKey($request);
        return $this->call(
            'POST',
            '/reservations/' . rawurlencode($reference) . '/capture',
            $request,
            $key
        );
    }

    public function release(string $reference, array $request): array
    {
        $key = $this->takeIdempotencyKey($request);
        return $this->call(
            'POST',
            '/reservations/' . rawurlencode($reference) . '/release',
            $request,
            $key
        );
    }

    public function status(string $reference): array
    {
        return $this->call('GET', '/reservations/' . rawurlencode($reference), null, null);
    }

    public function refund(string $redemptionId, array $request): array
    {
        $key = $this->takeIdempotencyKey($request);
        return $this->call(
            'POST',
            '/redemptions/' . rawurlencode($redemptionId) . '/refund',
            $request,
            $key
        );
    }

    public function orderEvent(array $request): array
    {
        $key = $this->takeIdempotencyKey($request);
        return $this->call('POST', '/orders/events', $request, $key);
    }

    private function takeIdempotencyKey(array &$request): string
    {
        $key = $request['idempotency_key'] ?? null;
        unset($request['idempotency_key']);
        if (!is_string($key) || $key === '') {
            throw new TazellaException('INVALID_REQUEST', 'An idempotency key is required.', false);
        }
        return $key;
    }

    private function call(string $method, string $path, ?array $body, ?string $idempotencyKey): array
    {
        $rawBody = '';
        if ($body !== null) {
            $encoded = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($encoded === false) {
                throw new TazellaException('INVALID_REQUEST', 'Could not encode request body.', false);
            }
            $rawBody = $encoded;
        }

        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp . '.' . $rawBody, $this->signingSecret);

        $headers = [
            'Authorization' => 'Bearer ' . $this->apiKey,
            'X-Platform-Code' => $this->platformCode,
            'X-Environment' => $this->environment,
            'X-Timestamp' => $timestamp,
            'X-Signature' => $signature,
            'Accept' => 'application/json',
        ];

        if ($method === 'POST') {
            $headers['Content-Type'] = 'application/json';
        }
        if ($idempotencyKey !== null) {
            $headers['X-Idempotency-Key'] = $idempotencyKey;
        }

        $response = $this->http->request(
            $this->baseUrl . '/api/integrations/v1' . $path,
            $method,
            $headers,
            $rawBody
        );

        $payload = json_decode($response['body'], true);
        if (!is_array($payload)) {
            throw new TazellaException(
                'INTERNAL_ERROR',
                'The gateway returned an unreadable response.',
                false,
                null,
                $response['status']
            );
        }

        $requestId = isset($payload['request_id']) && is_string($payload['request_id'])
            ? $payload['request_id']
            : null;

        if (empty($payload['ok'])) {
            $error = isset($payload['error']) && is_array($payload['error']) ? $payload['error'] : [];
            $code = isset($error['code']) && is_string($error['code']) ? $error['code'] : 'INTERNAL_ERROR';
            $rawMessage = isset($error['message']) && is_string($error['message']) ? $error['message'] : '';
            $retryable = !empty($error['retryable']);

            throw new TazellaException(
                $code,
                TazellaException::publicMessage($code, $rawMessage),
                $retryable,
                $requestId,
                $response['status']
            );
        }

        return isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : [];
    }
}
