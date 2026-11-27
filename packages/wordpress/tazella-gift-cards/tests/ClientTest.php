<?php

use PHPUnit\Framework\TestCase;
use Tazella\GiftCards\Client;
use Tazella\GiftCards\HttpClient;
use Tazella\GiftCards\TazellaException;

final class FakeHttpClient implements HttpClient
{
    public array $requests = [];
    private array $response;

    public function __construct(array $response)
    {
        $this->response = $response;
    }

    public function request(string $url, string $method, array $headers, string $body): array
    {
        $this->requests[] = ['url' => $url, 'method' => $method, 'headers' => $headers, 'body' => $body];
        return $this->response;
    }
}

final class ClientTest extends TestCase
{
    private function client(FakeHttpClient $http): Client
    {
        return new Client(
            'https://tazella.test',
            'wordpress',
            'sandbox',
            'tz_test_key',
            'test_signing_secret',
            $http
        );
    }

    public function testReserveSignsRequestAndSendsIdempotencyKey(): void
    {
        $http = new FakeHttpClient([
            'status' => 201,
            'body' => json_encode([
                'ok' => true,
                'request_id' => 'req_1',
                'data' => ['reservation_reference' => 'RSV-1', 'applied_amount_minor' => 15000],
            ]),
        ]);

        $result = $this->client($http)->reserve([
            'external_vendor_id' => 'ext-1',
            'card_code' => 'GFT-AB12CD34EF',
            'idempotency_key' => 'php_test_1',
        ]);

        $this->assertSame('RSV-1', $result['reservation_reference']);
        $request = $http->requests[0];
        $this->assertSame('https://tazella.test/api/integrations/v1/reservations', $request['url']);
        $this->assertSame('POST', $request['method']);
        $this->assertSame('php_test_1', $request['headers']['X-Idempotency-Key']);
        $this->assertSame('sandbox', $request['headers']['X-Environment']);

        $body = json_decode($request['body'], true);
        $this->assertArrayNotHasKey('idempotency_key', $body);

        $timestamp = $request['headers']['X-Timestamp'];
        $expected = hash_hmac('sha256', $timestamp . '.' . $request['body'], 'test_signing_secret');
        $this->assertSame($expected, $request['headers']['X-Signature']);
    }

    public function testErrorEnvelopeBecomesSafeException(): void
    {
        $http = new FakeHttpClient([
            'status' => 409,
            'body' => json_encode([
                'ok' => false,
                'request_id' => 'req_2',
                'error' => [
                    'code' => 'INSUFFICIENT_BALANCE',
                    'message' => 'raw database detail',
                    'retryable' => false,
                ],
            ]),
        ]);

        try {
            $this->client($http)->validate(['card_code' => 'GFT-X']);
            $this->fail('Expected an exception');
        } catch (TazellaException $error) {
            $this->assertSame('INSUFFICIENT_BALANCE', $error->errorCode());
            $this->assertSame('req_2', $error->requestId());
            $this->assertSame('This gift card does not have enough available balance.', $error->getMessage());
        }
    }
}
