-- Work handed to an agent instead of a model API (providers/agent.ts): the whole request behind a
-- pending receipt, kept until the agent's answer is saved on that receipt, then deleted.
CREATE TABLE agent_tasks (
  receipt_id  bigint PRIMARY KEY REFERENCES receipts (id) ON DELETE CASCADE,
  purpose     text NOT NULL,
  subject     text,
  -- The request's attemptTag: two tasks of one subject and purpose (the two scores) are answered apart.
  attempt     text,
  system      text NOT NULL,
  input       text NOT NULL,
  format      text NOT NULL CHECK (format IN ('json', 'text')),
  -- JSON Schema of the expected output (json format), when the step's schema converts.
  schema      jsonb,
  temperature real,
  max_tokens  integer,
  -- Why the previous answer to the same request could not be used.
  retry_note  text,
  -- The queue job that posted it ({ queue, id }), sent again when the answer arrives.
  resume      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  claimed_at  timestamptz,
  claims      integer NOT NULL DEFAULT 0
);
