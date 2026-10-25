-- Custom SQL migration file: CDC trigger and notify function --
CREATE OR REPLACE FUNCTION notify_rag_mutation()
RETURNS TRIGGER AS $$
DECLARE
  record_id TEXT;
  tenant_val TEXT;
  payload JSON;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    record_id := OLD.id::TEXT;
    tenant_val := COALESCE(OLD.tenant_id, current_setting('app.current_tenant', true));
  ELSE
    record_id := NEW.id::TEXT;
    tenant_val := COALESCE(NEW.tenant_id, current_setting('app.current_tenant', true));
  END IF;

  payload := json_build_object(
    'tenantId', COALESCE(tenant_val, 'default'),
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'recordId', record_id,
    'timestamp', to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
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