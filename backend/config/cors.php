<?php

/*
| Cross-Origin Resource Sharing (CORS)
|
| Locally (and with a Node.js host) the Next.js server proxies /api, so the browser never calls this API
| cross-origin and CORS doesn't apply. On static hosting (npm run build:static) the site at
| https://fitcheck.smartsitecp.com calls https://fitcheck-api.smartsitecp.com directly, with the sign-in
| cookies, so only the site's own address(es) may do that.
*/

$origins = array_values(array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:3000'))))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // The audit log export reads the file name from this header
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 600,

    // Sign-in uses the session cookie, so the browser must send cookies with cross-origin requests
    'supports_credentials' => true,
];
