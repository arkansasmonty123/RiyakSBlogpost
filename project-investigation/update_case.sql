-- Legacy helper retained for compatibility. The canonical case metadata now
-- lives in seed.sql (PROD-007). Applying seed.sql is preferred; this statement
-- is kept consistent with it for anyone still invoking update_case.sql directly.

UPDATE cases SET
  title       = 'The Midnight Heist',
  description = 'A priceless diamond vanishes from a museum gala during a twelve-minute blackout. Five suspects, one hidden passage, and a solution hidden in plain sight.',
  genre       = 'Heist',
  difficulty  = 'Standard',
  duration    = '4-7 days',
  publication_status = 'published',
  briefing    = 'The Star of the North, a 40-carat diamond on loan to the Grand Museum, disappeared from its case during the annual gala on the night of 15 November 2024. At 00:10 the motion sensors went dark for exactly twelve minutes. At 00:20 security guard Mills was found unconscious in the east wing. The diamond is still missing, and everyone who could have taken it has an alibi. Review the initial evidence, question the people involved, and reconstruct what really happened between 00:00 and 00:22.',
  objectives  = '["Reconstruct the twelve-minute blackout window","Explain the guard attack and why it happened","Identify who had access to the North Wing","Eliminate the competing inside-job theories","Name the culprit and explain how the diamond was removed"]',
  case_version = '1.1',
  updated_at   = NOW()
WHERE id = 'fba51632-6d0d-4736-8200-2fd6df5ba1cc';
