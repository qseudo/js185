INSERT INTO todolists (title)
VALUES 
('Work Todos'),
('Home Todos'),
('Additional Todos'),
('social todos');

INSERT INTO todos (todolist_id, title, done)
VALUES
(1, 'Get coffee', true),
(1, 'Chat with co-workers', true),
(1, 'Duck out of meeting', DEFAULT),
(2, 'Feed the cats', true),
(2, 'Go to bed', true),
(2, 'Buy milk', true),
(2, 'Study for Launch School', true),
(4, 'Go to Libby''s birthday party', DEFAULT);
