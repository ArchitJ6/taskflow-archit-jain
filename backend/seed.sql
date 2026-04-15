-- Seed data for TaskFlow
-- Password: password123 (bcrypt, cost=12)
-- Generated hash: $2b$12$kd2/azA5kTU8C8daP9N2teGsF8BmjLsHspnmiqOpACWuBtbH2cJc6

INSERT INTO users (id, name, email, password, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Test User',
    'test@example.com',
    '$2b$12$kd2/azA5kTU8C8daP9N2teGsF8BmjLsHspnmiqOpACWuBtbH2cJc6',
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO projects (id, name, description, owner_id, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'Website Redesign',
    'Q2 redesign project with new branding and improved UX',
    '00000000-0000-0000-0000-000000000001',
    NOW()
) ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, created_by_id, due_date, created_at, updated_at)
VALUES
    (
        '00000000-0000-0000-0000-000000000101',
        'Design new homepage mockups',
        'Create Figma mockups for the new homepage with hero section, features, and CTA.',
        'done',
        'high',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        '2026-04-10',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000102',
        'Implement React frontend',
        'Build the React components based on approved Figma designs.',
        'in_progress',
        'high',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        '2026-04-20',
        NOW(),
        NOW()
    ),
    (
        '00000000-0000-0000-0000-000000000103',
        'Write API integration tests',
        'Add integration tests covering auth, project CRUD, and task CRUD.',
        'todo',
        'medium',
        '00000000-0000-0000-0000-000000000010',
        NULL,
        '00000000-0000-0000-0000-000000000001',
        '2026-04-25',
        NOW(),
        NOW()
    )
ON CONFLICT DO NOTHING;
