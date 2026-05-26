-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE net._http_response (
  id bigint,
  status_code integer,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE net.http_request_queue (
  id bigint NOT NULL DEFAULT nextval('net.http_request_queue_id_seq'::regclass),
  method text NOT NULL,
  url text NOT NULL,
  headers jsonb,
  body bytea,
  timeout_milliseconds integer NOT NULL
);