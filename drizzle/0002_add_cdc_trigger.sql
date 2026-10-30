CREATE OR REPLACE FUNCTION notify_rag_mutation()
RETURNS TRIGGER AS $$
DECLARE
  rec_id TEXT;
  t_id TEXT;
  payload JSON;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    rec_id := OLD.id::TEXT;
    t_id := OLD.tenant_id::TEXT;
  ELSE
    rec_id := NEW.id::TEXT;
    t_id := NEW.tenant_id::TEXT;
  END IF;

  payload := json_build_object(
    'tenantId', t_id,
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'recordId', rec_id,
    'timestamp', clock_timestamp()
  );

  PERFORM pg_notify('rag_cdc_channel', payload::text);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_products_rag_cdc ON products;
--> statement-breakpoint
CREATE TRIGGER trg_products_rag_cdc
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION notify_rag_mutation();
