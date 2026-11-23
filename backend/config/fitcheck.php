<?php

return [
    /*
     | Default password for the seeded accounts. Every seeded account must change
     | it, and set an email and display name, on first sign-in.
     */
    'default_password' => env('DEFAULT_ADMIN_PASSWORD', 'Admin@1234'),

    'seed_accounts' => [
        ['username' => 'dev-admin', 'role' => 'developer'],
        ['username' => 'dev-admin-1', 'role' => 'developer'],
        ['username' => 'super-admin', 'role' => 'admin'],
    ],

    'roles' => [
        'developer' => 'Developer',
        'admin' => 'Admin',
    ],

    /*
     | Permissions per role. "*" grants everything. Every API route checks one
     | of these through a Gate, never a role name directly.
     */
    'permissions' => [
        'developer' => ['*'],
        'admin' => [
            'dashboard.view',
            'screenviews.manage',
            'families.manage',
            'users.manage',
            'audit.view',
            'audit.export',
            'settings.manage',
        ],
    ],

    'all_permissions' => [
        'dashboard.view', 'screenviews.manage', 'families.manage', 'users.manage',
        'audit.view', 'audit.export', 'systemlogs.view', 'settings.manage',
    ],

    /* Global settings and their defaults (stored in the settings table). */
    'settings' => [
        'security.two_factor_enforced' => false,
        'security.session_timeout_minutes' => 30,
        'security.password_min_length' => 8,
        'security.max_login_attempts' => 5,
        'security.lockout_minutes' => 15,
    ],

    'device_types' => ['Mobile', 'Tablet', 'Desktop', 'TV'],
    'frames' => ['island', 'notch', 'hole', 'home', 'tablet', 'browser', 'tv', 'none'],
];
